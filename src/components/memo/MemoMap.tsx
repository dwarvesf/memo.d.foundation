import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { IMemoItem } from '@/types';
import { formatContentPath } from '@/lib/utils/path-utils';
import { Input } from '../ui/input';

interface MemoMapProps {
  memos: IMemoItem[];
  authorUsername: string;
}

// Extended from D3's types with the properties we need
interface GNode {
  id: string;
  title: string;
  references: number;
  url: string;
  // D3 simulation properties
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
  index?: number;
  labelVisible?: boolean;
  r?: number; // Store the calculated radius for the node
  matchesSearch?: boolean;
  _originalOpacity?: string;
  _originalRadius?: string;
  _originalVisibility?: string;
}

interface Link {
  source: string | GNode;
  target: string | GNode;
  _originalOpacity?: string;
  _originalColor?: string;
}

const MemoMap: React.FC<MemoMapProps> = ({ memos, authorUsername }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoom = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const nodesRef = useRef<d3.Selection<
    SVGCircleElement,
    GNode,
    SVGGElement,
    unknown
  > | null>(null);
  const linksRef = useRef<d3.Selection<
    SVGLineElement,
    Link,
    SVGGElement,
    unknown
  > | null>(null);
  const labelsRef = useRef<d3.Selection<
    SVGTextElement,
    GNode,
    SVGGElement,
    unknown
  > | null>(null);
  const isHoveringRef = useRef<boolean>(false);

  // Utility functions
  const uniqBy = <T extends Record<string, any>>(
    arr: T[],
    prop: string,
  ): T[] => {
    const uniqueObjects: Record<string, boolean> = {};
    return arr.filter(obj => {
      if (!uniqueObjects[obj[prop]]) {
        uniqueObjects[obj[prop]] = true;
        return true;
      }
      return false;
    });
  };

  const getRandomNumberInRange = (min: number, max: number) => {
    return Math.round(Math.random() * (max - min) + min);
  };

  // Find memos by author
  const findMemosByAuthor = (username: string) => {
    return memos.filter(memo =>
      (memo.authors || []).some(author => author === username),
    );
  };

  // Function to handle search - highlights matching nodes
  const handleSearch = (query: string) => {
    setSearchQuery(query);

    if (!nodesRef.current || !linksRef.current || !labelsRef.current) return;

    // Reset all nodes first
    nodesRef.current
      .attr('fill-opacity', 1)
      .attr('fill', '#e13F5e')
      .attr('r', d => d.r || 20);

    linksRef.current.attr('stroke', '#9B9B9B').attr('stroke-opacity', 1);

    labelsRef.current.style('visibility', d =>
      d.labelVisible ? 'visible' : 'hidden',
    );

    if (!query) {
      return;
    }

    const lowercasedQuery = query.toLowerCase();

    // Store query in the nodes for later reference
    if (nodesRef.current) {
      nodesRef.current.each(function (d) {
        d.matchesSearch = d.title.toLowerCase().includes(lowercasedQuery);
      });
    }

    // Check which nodes match the query
    const matchingNodes = nodesRef.current.filter(
      d => d.matchesSearch === true,
    );

    // Dim all nodes
    nodesRef.current.attr('fill-opacity', 0.15).attr('r', d => d.r || 20);

    // Dim all links
    linksRef.current.attr('stroke-opacity', 0.15);

    // Hide all labels
    labelsRef.current.style('visibility', 'hidden');

    // Highlight matching nodes
    matchingNodes
      .attr('fill-opacity', 1)
      .attr('fill', '#e13F5e')
      .attr('r', d => (d.r || 20) * 1.1);

    // Show labels for matching nodes
    labelsRef.current
      .filter(d => d.matchesSearch === true)
      .style('visibility', 'visible');

    // Highlight links connected to matching nodes
    matchingNodes.each(function (d) {
      const connectedLinks = linksRef.current!.filter(linkData => {
        const source =
          typeof linkData.source === 'string'
            ? linkData.source
            : (linkData.source as GNode).id;

        const target =
          typeof linkData.target === 'string'
            ? linkData.target
            : (linkData.target as GNode).id;

        return source === d.id || target === d.id;
      });

      connectedLinks.attr('stroke', '#e13F5e').attr('stroke-opacity', 1);
    });
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !memos.length) return;

    // Clear previous graph
    d3.select(svgRef.current).selectAll('*').remove();

    // Configs
    const NODE_COLOR = '#e13F5e';
    const LINK_COLOR = '#9B9B9B';
    const HIGHLIGHT_COLOR = '#e13F5e';
    const MAX_FONT_SIZE = 16;
    const MIN_FONT_SIZE = 8;
    const MAX_DISTANCE = 350;
    const MIN_DISTANCE = 150;
    const MIN_REF_COUNT = 5;
    const MENU_COUNT_BUFFER = 10;
    const MIN_ZOOM_LEVEL = 0.1;
    const MAX_ZOOM_LEVEL = 5;
    const HOVER_COLOR_OPACITY = 0.15;
    const HOVER_SCALE_RATIO = 1.1;
    const SHOW_TEXT_AT_SCALE = 1.1;
    const DEFAULT_ZOOM_LEVEL = 0.2;
    const AUTO_HIDE_LABEL_THRESHOLD = 50;

    // state
    let dragging = false;

    // get container size
    const h = containerRef.current.clientHeight / 2;
    const w = containerRef.current.clientWidth / 2;

    // ============ DATA PROCESS LOGIC ============ //
    // Find all memos by this author
    const authorMemos = findMemosByAuthor(authorUsername);

    // Data for render
    let gNodes: GNode[] = [];
    const nodeLinks: Link[] = [];

    // Create author node as center
    const authorNode: GNode = {
      id: `/contributor/${authorUsername}`,
      title: `@${authorUsername}`,
      references: MIN_REF_COUNT + authorMemos.length + MENU_COUNT_BUFFER,
      url: `/contributor/${authorUsername}`,
    };

    gNodes.push(authorNode);

    // Add memo nodes connected to the author
    authorMemos.forEach(memo => {
      const memoNode: GNode = {
        id: memo.filePath,
        title: memo.title,
        references: MIN_REF_COUNT,
        url: formatContentPath(memo.filePath),
      };

      gNodes.push(memoNode);

      // Connect memo to author
      nodeLinks.push({
        source: memoNode.id,
        target: authorNode.id,
      });
    });

    // Remove any duplicate nodes
    gNodes = uniqBy(gNodes, 'id');

    if (!gNodes.length) return;

    const canShowAllLabels = gNodes.length < AUTO_HIDE_LABEL_THRESHOLD;

    // ============ GRAPH DRAWING ============ //
    const svg = d3.select(svgRef.current);
    const container = svg.append('g');

    // Scale for node size based on references
    const sizeScale = d3
      .scaleLinear()
      .domain([1, d3.max(gNodes, d => d.references || MIN_REF_COUNT) as number])
      .range([20, 40]);

    // Store initial size for search functionality
    gNodes.forEach(node => {
      node.r = sizeScale(node.references || MIN_REF_COUNT);
      node.labelVisible = canShowAllLabels;
    });

    // Create the simulation with our custom nodes
    // We have to use any here because D3's type system is hard to match perfectly
    const simulation = d3
      .forceSimulation(gNodes as any)
      .force(
        'charge',
        d3
          .forceManyBody()
          .strength((d: any) => -50 * sizeScale(d.references || MIN_REF_COUNT)),
      )
      .force(
        'link',
        d3
          .forceLink(nodeLinks)
          .id((d: any) => d.id)
          .distance((d: any) => {
            const source = d.source as any;
            const target = d.target as any;
            const referenceCount = source.references + target.references;
            const dynamicDistance = getRandomNumberInRange(
              MIN_DISTANCE,
              MAX_DISTANCE +
                (referenceCount > 50 ? referenceCount * 2 : referenceCount * 3),
            );
            return Math.min(dynamicDistance, MAX_DISTANCE + referenceCount * 5);
          }),
      )
      .force('center', d3.forceCenter(w, h));

    const link = container
      .selectAll('line')
      .data(nodeLinks)
      .enter()
      .append('line')
      .attr('stroke', LINK_COLOR);

    linksRef.current = link;

    const label = container
      .selectAll('text')
      .data(gNodes)
      .enter()
      .append('text')
      .text(d => d.title)
      .attr('x', 8)
      .attr('y', 3)
      .attr('class', 'fill-current text-foreground')
      .style('font-size', '12px')
      .style('visibility', canShowAllLabels ? 'visible' : 'hidden');

    labelsRef.current = label;

    const isConnected = (a: GNode, b: GNode) => {
      return nodeLinks.some(link => {
        const sourceId =
          typeof link.source === 'string' ? link.source : link.source.id;
        const targetId =
          typeof link.target === 'string' ? link.target : link.target.id;
        return (
          (sourceId === a.id && targetId === b.id) ||
          (sourceId === b.id && targetId === a.id)
        );
      });
    };

    const handleMouseOver = function (
      this: SVGCircleElement,
      event: MouseEvent,
      d: GNode,
    ) {
      if (dragging) {
        return;
      }

      isHoveringRef.current = true;

      // Save original state to restore on mouseout
      nodesRef.current!.each(function (node) {
        node._originalOpacity = d3.select(this).attr('fill-opacity');
        node._originalRadius = d3.select(this).attr('r');
      });

      linksRef.current!.each(function (link) {
        link._originalOpacity = d3.select(this).attr('stroke-opacity');
        link._originalColor = d3.select(this).attr('stroke');
      });

      labelsRef.current!.each(function (label) {
        label._originalVisibility = d3.select(this).style('visibility');
      });

      const connectedLinks = linksRef.current!.filter(linkData => {
        const source =
          typeof linkData.source === 'string'
            ? linkData.source
            : (linkData.source as GNode).id;

        const target =
          typeof linkData.target === 'string'
            ? linkData.target
            : (linkData.target as GNode).id;

        return source === d.id || target === d.id;
      });

      // Highlight the hovered node
      d3.select(this).attr(
        'r',
        sizeScale(d.references || MIN_REF_COUNT) * HOVER_SCALE_RATIO,
      );

      // Show the title of the hovered node
      labelsRef
        .current!.filter(nodeData => nodeData.id === d.id)
        .style('visibility', 'visible');

      // Show titles of connected nodes
      connectedLinks.each(function (linkData) {
        let connectedNodeId: string;

        if (typeof linkData.source === 'string') {
          connectedNodeId =
            linkData.source === d.id
              ? (linkData.target as string)
              : linkData.source;
        } else if (typeof linkData.target === 'string') {
          connectedNodeId =
            linkData.target === d.id ? linkData.source.id : linkData.target;
        } else {
          connectedNodeId =
            linkData.source.id === d.id
              ? linkData.target.id
              : linkData.source.id;
        }

        labelsRef
          .current!.filter(nodeData => nodeData.id === connectedNodeId)
          .style('visibility', 'visible');
      });

      // Highlight the connected links
      connectedLinks.attr('stroke', HIGHLIGHT_COLOR);

      // Fade out unconnected nodes
      nodesRef
        .current!.filter(
          nodeData => nodeData.id !== d.id && !isConnected(d, nodeData),
        )
        .attr('fill-opacity', HOVER_COLOR_OPACITY);

      // Fade out unconnected links
      linksRef
        .current!.filter(linkData => {
          const source =
            typeof linkData.source === 'string'
              ? linkData.source
              : (linkData.source as GNode).id;

          const target =
            typeof linkData.target === 'string'
              ? linkData.target
              : (linkData.target as GNode).id;

          return source !== d.id && target !== d.id;
        })
        .attr('stroke-opacity', HOVER_COLOR_OPACITY);
    };

    const handleMouseOut = function (
      this: SVGCircleElement,
      event: MouseEvent,
      d: GNode,
    ) {
      if (dragging) {
        return;
      }

      isHoveringRef.current = false;

      // Restore original node size for the hovered node
      d3.select(this).attr(
        'r',
        d.r || sizeScale(d.references || MIN_REF_COUNT),
      );

      // If we have a search query, reapply search after a short delay
      if (searchQuery) {
        setTimeout(() => {
          if (!isHoveringRef.current) {
            handleSearch(searchQuery);
          }
        }, 50);
        return;
      }

      // Restore original states if no search query
      nodesRef.current!.each(function (node) {
        d3.select(this)
          .attr('fill-opacity', node._originalOpacity || 1)
          .attr('r', node._originalRadius || node.r || 20);
      });

      linksRef.current!.each(function (link) {
        d3.select(this)
          .attr('stroke-opacity', link._originalOpacity || 1)
          .attr('stroke', link._originalColor || LINK_COLOR);
      });

      labelsRef.current!.each(function (label) {
        d3.select(this).style(
          'visibility',
          label._originalVisibility ||
            (label.labelVisible ? 'visible' : 'hidden'),
        );
      });
    };

    const node = container
      .selectAll('circle')
      .data(gNodes)
      .enter()
      .append('circle')
      .attr('r', d => sizeScale(d.references || MIN_REF_COUNT))
      .attr('fill', NODE_COLOR)
      .attr('class', 'cursor-pointer')
      .on('mouseover', handleMouseOver as any)
      .on('mouseout', handleMouseOut as any);

    nodesRef.current = node;

    simulation.on('tick', () => {
      link
        .attr('x1', d => {
          const source = d.source as any;
          return source.x || 0;
        })
        .attr('y1', d => {
          const source = d.source as any;
          return source.y || 0;
        })
        .attr('x2', d => {
          const target = d.target as any;
          return target.x || 0;
        })
        .attr('y2', d => {
          const target = d.target as any;
          return target.y || 0;
        });

      node
        .attr('cx', d => d.x || 0)
        .attr('cy', d => d.y || 0)
        .attr('r', d => sizeScale(d.references || MIN_REF_COUNT));

      label
        .attr('x', d => d.x || 0)
        .attr(
          'y',
          d => (d.y || 0) + sizeScale(d.references || MIN_REF_COUNT) + 25,
        )
        .attr('text-anchor', 'middle');
    });

    const zoomed = (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      const transform = event.transform;
      container.attr('transform', transform.toString());

      if (transform.k > SHOW_TEXT_AT_SCALE) {
        // Update label visibility state
        gNodes.forEach(node => {
          node.labelVisible = true;
        });

        if (!searchQuery) {
          labelsRef.current!.style('visibility', 'visible');
        }
      } else {
        // Update label visibility state
        gNodes.forEach(node => {
          node.labelVisible = canShowAllLabels;
        });

        if (!searchQuery) {
          labelsRef.current!.style(
            'visibility',
            canShowAllLabels ? 'visible' : 'hidden',
          );
        }
      }

      labelsRef.current!.style(
        'font-size',
        `${Math.max(
          MAX_FONT_SIZE / (transform.k > 0.4 ? transform.k : 0.4),
          MIN_FONT_SIZE,
        )}px`,
      );

      // Reapply search highlight if active
      if (searchQuery && !isHoveringRef.current) {
        setTimeout(() => {
          if (!isHoveringRef.current) {
            handleSearch(searchQuery);
          }
        }, 50);
      }
    };

    const newZoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL])
      .on('zoom', zoomed);

    zoom.current = newZoom;

    svg.call(newZoom);
    svg.call(newZoom.scaleTo, DEFAULT_ZOOM_LEVEL);

    const dragstarted = function (
      this: SVGCircleElement,
      event: any,
      d: GNode,
    ) {
      dragging = true;
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;

      d3.select(this)
        .attr('r', sizeScale(d.references || MIN_REF_COUNT) * HOVER_SCALE_RATIO)
        .attr('fill', HIGHLIGHT_COLOR);

      labelsRef
        .current!.filter(nodeData => nodeData.id === d.id)
        .style('visibility', 'visible');
    };

    const dragged = (event: any, d: GNode) => {
      dragging = true;
      d.fx = event.x;
      d.fy = event.y;
    };

    const dragended = (event: any, d: GNode) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;

      dragging = false;

      // Reapply search highlight if active
      if (searchQuery && !isHoveringRef.current) {
        setTimeout(() => {
          if (!isHoveringRef.current) {
            handleSearch(searchQuery);
          }
        }, 50);
      }
    };

    const drag = d3
      .drag<SVGCircleElement, GNode>()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);

    node.call(drag as any);

    // Attach click event listener to nodes
    node.on('click', function (event: MouseEvent, d: GNode) {
      // Navigate using router or window.location depending on your app setup
      window.location.href = d.url;
    });

    // Cleanup function
    return () => {
      // Clean up simulation to prevent memory leaks
      if (simulation) {
        simulation.stop();
      }
    };
  }, [memos, authorUsername]); // Re-render when memos or authorUsername changes

  // Apply search effects when searchQuery changes
  useEffect(() => {
    handleSearch(searchQuery);
  }, [searchQuery]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Input
          type="text"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute top-1/2 right-2 -translate-y-1/2 transform text-gray-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>
      <div
        className="bg-background-secondary aspect-square w-full rounded-md"
        ref={containerRef}
      >
        <svg ref={svgRef} width="100%" height="100%"></svg>
      </div>
    </div>
  );
};

export default MemoMap;

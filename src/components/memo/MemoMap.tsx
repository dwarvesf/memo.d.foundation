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
  type?: 'author' | 'tag' | 'memo'; // Type of node
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
    const TAG_NODE_BASE_SIZE = 40;
    const MEMO_NODE_BASE_SIZE = 10;
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

    // Extract all unique tags from the author's memos
    const tagToMemosMap: Record<string, IMemoItem[]> = {};

    // Track memo nodes by ID to handle cross-linking between tags
    const memoNodesById: Record<string, GNode> = {};

    authorMemos.forEach(memo => {
      if (memo.tags && memo.tags.length > 0) {
        memo.tags.forEach(tag => {
          if (!tagToMemosMap[tag]) {
            tagToMemosMap[tag] = [];
          }
          tagToMemosMap[tag].push(memo);
        });
      } else {
        // For memos without tags, create a special "untagged" category
        const untaggedKey = 'untagged';
        if (!tagToMemosMap[untaggedKey]) {
          tagToMemosMap[untaggedKey] = [];
        }
        tagToMemosMap[untaggedKey].push(memo);
      }
    });

    // Create tag nodes and their associated memo nodes
    Object.entries(tagToMemosMap).forEach(([tag, tagMemos]) => {
      const tagNode: GNode = {
        id: `tag-${tag}`,
        title: `#${tag}`,
        references: MIN_REF_COUNT + tagMemos.length * 4,
        url: `/tags/${tag}`, // This can be modified based on your app's routing
        type: 'tag',
      };

      gNodes.push(tagNode);

      // Add memo nodes connected to this tag
      tagMemos.forEach(memo => {
        // Create or reuse memo node
        if (!memoNodesById[memo.filePath]) {
          const memoNode: GNode = {
            id: memo.filePath,
            title: memo.title,
            references: MIN_REF_COUNT,
            url: formatContentPath(memo.filePath),
            type: 'memo',
          };
          memoNodesById[memo.filePath] = memoNode;
          gNodes.push(memoNode);
        }

        // Connect memo to tag
        nodeLinks.push({
          source: memoNodesById[memo.filePath].id,
          target: tagNode.id,
        });
      });
    });

    // Look for memos that share multiple tags and create links between tags
    // This creates a more interconnected network through shared memos
    const processedTagPairs = new Set<string>();

    Object.entries(tagToMemosMap).forEach(([tagA, memosA]) => {
      Object.entries(tagToMemosMap).forEach(([tagB, memosB]) => {
        // Skip self-comparison and already processed pairs
        if (
          tagA === tagB ||
          processedTagPairs.has(`${tagA}-${tagB}`) ||
          processedTagPairs.has(`${tagB}-${tagA}`)
        ) {
          return;
        }

        // Find shared memos between these tags
        const sharedMemos = memosA.filter(memoA =>
          memosB.some(memoB => memoB.filePath === memoA.filePath),
        );

        // If there are shared memos, create a link between these tags
        if (sharedMemos.length > 0) {
          nodeLinks.push({
            source: `tag-${tagA}`,
            target: `tag-${tagB}`,
          });

          // Mark this pair as processed
          processedTagPairs.add(`${tagA}-${tagB}`);
        }
      });
    });

    // Remove any duplicate nodes
    gNodes = uniqBy(gNodes, 'id');

    if (!gNodes.length) return;

    const canShowAllLabels = gNodes.length < AUTO_HIDE_LABEL_THRESHOLD;

    // ============ GRAPH DRAWING ============ //
    const svg = d3.select(svgRef.current);
    const container = svg.append('g');

    // Store initial size for search functionality
    gNodes.forEach(node => {
      // Adjust size based on node type
      if (node.type === 'tag') {
        node.r = TAG_NODE_BASE_SIZE + (node.references || MIN_REF_COUNT) / 1.5;
      } else if (node.type === 'memo') {
        node.r = MEMO_NODE_BASE_SIZE;
      }
      node.labelVisible = canShowAllLabels;
    });

    // Create the simulation with our custom nodes
    const simulation = d3
      .forceSimulation(gNodes as any)
      .force(
        'charge',
        d3.forceManyBody().strength((d: any) => {
          // Adjust repulsion force based on node type
          if (d.type === 'tag') {
            return -100 * (d.r || TAG_NODE_BASE_SIZE);
          } else {
            return -30 * (d.r || MEMO_NODE_BASE_SIZE);
          }
        }),
      )
      .force(
        'link',
        d3
          .forceLink(nodeLinks)
          .id((d: any) => d.id)
          .distance((d: any) => {
            const source = d.source as any;
            const target = d.target as any;

            // Adjust distance based on node types
            if (source.type === 'tag' && target.type === 'tag') {
              // Tag to tag links should be longer
              return MAX_DISTANCE * 0.8;
            } else if (
              (source.type === 'tag' && target.type === 'memo') ||
              (source.type === 'memo' && target.type === 'tag')
            ) {
              // Tag to memo links should be shorter
              return MIN_DISTANCE * 1.2;
            } else {
              // Default distance calculation
              return MIN_DISTANCE * 1.5;
            }
          }),
      )
      .force('center', d3.forceCenter(w, h))
      // Add collision detection to prevent overlap
      .force(
        'collision',
        d3.forceCollide().radius((d: any) => (d.r || 20) + 8),
      )
      // Add some slight gravity toward the center
      .force('x', d3.forceX(w).strength(0.05))
      .force('y', d3.forceY(h).strength(0.05));

    // Create a group for links that will be at the bottom layer
    const linksGroup = container.append('g').attr('class', 'links-group');

    // Create a group for nodes that will be in the middle layer
    const nodesGroup = container.append('g').attr('class', 'nodes-group');

    // Create a group for labels that will be at the top layer
    const labelsGroup = container.append('g').attr('class', 'labels-group');

    const link = linksGroup
      .selectAll('line')
      .data(nodeLinks)
      .enter()
      .append('line')
      .attr('stroke', LINK_COLOR)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => {
        // Make links between tags thicker
        const source = d.source as any;
        const target = d.target as any;
        if (source.type === 'tag' && target.type === 'tag') {
          return 2;
        }
        return 1;
      });

    linksRef.current = link;

    // Create labels before nodes to establish layer order
    const label = labelsGroup
      .selectAll('text')
      .data(gNodes)
      .enter()
      .append('text')
      .text(d => d.title)
      .attr('x', 8)
      .attr('y', 3)
      .attr('class', 'fill-current text-foreground')
      .style('font-size', d => (d.type === 'tag' ? '14px' : '12px'))
      .style('font-weight', d => (d.type === 'tag' ? 'bold' : 'normal'))
      .style('visibility', canShowAllLabels ? 'visible' : 'hidden')
      .style('pointer-events', 'none'); // Ensures labels don't interfere with mouse events

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
      d3.select(this).attr('r', (d.r || 20) * HOVER_SCALE_RATIO);

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
      d3.select(this).attr('r', d.r || 20);

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

    // Now create nodes after defining the handler functions
    const node = nodesGroup
      .selectAll('circle')
      .data(gNodes)
      .enter()
      .append('circle')
      .attr('r', d => d.r || 20)
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
        .attr('r', d => d.r || 20);

      label
        .attr('x', d => d.x || 0)
        .attr('y', d => (d.y || 0) - (d.r || 20) - 10)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'auto');
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
        .attr('r', (d.r || 20) * HOVER_SCALE_RATIO)
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
      // For tag nodes, we might want to filter by tag instead of navigating
      if (d.type === 'tag') {
        // Optional: implement tag filtering logic here
        // For now, just navigate to the URL
        window.location.href = d.url;
      } else {
        // Navigate using router or window.location depending on your app setup
        window.location.href = d.url;
      }
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

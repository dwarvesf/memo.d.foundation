import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { ScrollArea, ScrollBar } from '../ui/scrollarea';
import { CompactContributorProfile } from '@/types/user';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '../ui/hover-card';
import { Avatar, AvatarImage } from '../ui/avatar';
import { useMemo, useState } from 'react';
import Jdenticon from 'react-jdenticon';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '../ui/chart';
import BookOpenIcon from '../icons/BookOpenIcon';
import { GraduationCapIcon, HammerIcon, SigmaIcon } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

function AvatarCluster({ authors }: { authors: CompactContributorProfile[] }) {
  const [first, second, third, fourth, fifth, sixth, seventh, eighth] =
    authors.map(a => (
      <AvatarImage key={a.avatar} src={a.avatar} className="no-zoom !m-0" />
    ));
  const baseClass = 'absolute rounded-full';
  return (
    <div className="relative mt-10 h-44 overflow-hidden">
      <div className="from-background absolute top-0 left-0 z-10 h-full w-1/3 bg-gradient-to-r to-transparent" />
      <div className="from-background absolute top-0 right-0 z-10 h-full w-1/3 bg-gradient-to-l to-transparent" />
      <Avatar
        className={cn(
          baseClass,
          'top-1/2 left-1/2 h-26 w-26 -translate-x-full -translate-y-4/5',
        )}
      >
        {first}
      </Avatar>
      <Avatar
        className={cn(
          baseClass,
          'top-1/2 left-1/2 h-20 w-20 -translate-x-1 -translate-y-6',
        )}
      >
        {second}
      </Avatar>
      <Avatar
        className={cn(
          baseClass,
          'top-1/2 left-1/2 h-14 w-14 -translate-x-full translate-y-7',
        )}
      >
        {third}
      </Avatar>
      <Avatar
        className={cn(
          baseClass,
          'top-1/2 left-1/2 h-14 w-14 translate-x-1 -translate-y-22',
        )}
      >
        {fourth}
      </Avatar>
      <Avatar
        className={cn(
          baseClass,
          'top-1/2 left-1/2 h-10 w-10 -translate-x-26 translate-y-7',
        )}
      >
        {fifth}
      </Avatar>
      <Avatar
        className={cn(
          baseClass,
          'top-1/2 left-1/2 h-10 w-10 translate-x-16 -translate-y-14',
        )}
      >
        {sixth}
      </Avatar>
      <Avatar
        className={cn(
          baseClass,
          'top-1/2 left-1/2 h-8 w-8 -translate-x-34 -translate-y-2',
        )}
      >
        {seventh}
      </Avatar>
      <Avatar
        className={cn(
          baseClass,
          'top-1/2 left-1/2 h-8 w-8 translate-x-22 -translate-y-2',
        )}
      >
        {eighth}
      </Avatar>
    </div>
  );
}

const chartConfig = {
  point: {
    label: 'Points',
    color: 'var(--primary)',
  },
} satisfies ChartConfig;

function Contributor({
  data,
  count,
  topCount,
  latestWork,
  viewing,
}: {
  topCount: number;
  count: number;
  data: CompactContributorProfile | string;
  latestWork: { date: string; url: string; title: string };
  viewing: 'all' | 'craftsmen' | 'alumni';
}) {
  const isUnknown = typeof data === 'string';
  const name = typeof data === 'string' ? data : data.name;
  const isAlumni = typeof data !== 'string' && data.is_alumni;

  const avatar = useMemo(() => {
    if (isUnknown) {
      return <Jdenticon value={data} size={20} />;
    }

    return <AvatarImage className="no-zoom !m-0" src={data.avatar} />;
  }, [data, isUnknown]);

  // Convert stats data to radar chart format
  const aspectData = useMemo(() => {
    const stats = typeof data === 'string' ? null : data?.analysis_result;
    const empty = [
      { aspect: 'Technician', point: 0, fullMark: 10 },
      { aspect: 'Manager', point: 0, fullMark: 10 },
      { aspect: 'Operator', point: 0, fullMark: 10 },
      { aspect: 'Consultant', point: 0, fullMark: 10 },
      { aspect: 'Builder', point: 0, fullMark: 10 },
    ];
    if (!stats) return empty;

    try {
      const attributes = stats.attributes;
      if (!attributes) return empty;

      return [
        {
          aspect: 'Technician',
          point: attributes.technician,
          fullMark: 10,
        },
        {
          aspect: 'Manager',
          point: attributes.manager,
          fullMark: 10,
        },
        {
          aspect: 'Operator',
          point: attributes.operator,
          fullMark: 10,
        },
        {
          aspect: 'Consultant',
          point: attributes.consultant,
          fullMark: 10,
        },
        {
          aspect: 'Builder',
          point: attributes.builder,
          fullMark: 10,
        },
      ];
    } catch (e) {
      console.error('Error parsing contributor stats:', e);
      return [];
    }
  }, [name]);

  // Find the aspect with the highest point value
  const topAspect = useMemo(() => {
    if (aspectData.length === 0) {
      return { aspect: 'Builder', point: 0 };
    }
    return aspectData.reduce(
      (prev, current) => (prev.point > current.point ? prev : current),
      aspectData[0],
    );
  }, [aspectData]);

  const isHighlight =
    viewing === 'all' ||
    (viewing === 'craftsmen' && !isAlumni) ||
    (viewing === 'alumni' && isAlumni);

  return (
    <div
      className={cn('relative flex w-full justify-start transition', {
        'opacity-100': isHighlight,
        'opacity-10': !isHighlight,
      })}
    >
      <div
        className="absolute inset-0 rounded bg-[rgb(235,235,235)] dark:bg-[rgb(56,56,56)]"
        style={{ width: `${(count / topCount) * 100}%` }}
      />
      <HoverCard>
        <HoverCardTrigger asChild>
          <Link href={`/contributor/${name}`}>
            <div className="relative flex cursor-pointer items-center justify-start gap-1.5 px-2 py-1">
              <Avatar className="dark:bg-secondary flex h-5 w-5 items-center justify-center border-2 bg-[#fff]">
                {avatar}
              </Avatar>
              <span className="shrink-0 text-sm">{name}</span>
            </div>
          </Link>
        </HoverCardTrigger>
        <HoverCardContent hidden={!isHighlight} side="right" asChild>
          <div className="!bg-background flex w-[300px] flex-col items-center !p-0">
            <div className="border-border mb-5 flex w-full items-start gap-x-2 border-b px-3 py-2">
              <Avatar className="dark:bg-secondary mt-1 flex h-9 w-9 items-center justify-center border-2 bg-[#fff]">
                {avatar}
              </Avatar>
              <div className="flex min-w-0 flex-col items-start">
                <span className="text-lg font-bold">{name}</span>
                <span className="text-muted-foreground flex w-full items-center gap-x-1 text-sm">
                  <span className="shrink-0">{topAspect.aspect}</span>
                </span>
                <div className="text-muted-foreground flex items-center gap-x-1 text-sm">
                  <SigmaIcon className="h-3 w-3 shrink-0" />
                  <span className="shrink-0">Total memos: {count}</span>
                </div>
                <span className="text-muted-foreground flex w-full items-center gap-x-1 text-sm">
                  <BookOpenIcon className="h-3 w-3 shrink-0" />
                  <span className="shrink-0">Latest: </span>
                  <Link className="truncate" href={latestWork?.url}>
                    {latestWork?.title}
                  </Link>
                </span>
              </div>
            </div>
            <ChartContainer config={chartConfig} className="w-full">
              <RadarChart data={aspectData}>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <PolarRadiusAxis
                  angle={90}
                  hide
                  tick={false}
                  domain={[0, 10]}
                />
                <PolarAngleAxis dataKey="aspect" />
                <PolarGrid />
                <Radar
                  dataKey="point"
                  fillOpacity={0.6}
                  fill="var(--primary)"
                  isAnimationActive={false}
                />
              </RadarChart>
            </ChartContainer>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

function ContributorList({
  data,
  contributionCount,
  contributorLatestWork,
  topCount,
}: {
  data: (CompactContributorProfile | string)[];
  contributionCount: Record<string, number>;
  contributorLatestWork: Record<
    string,
    { date: string; title: string; url: string }
  >;
  topCount: number;
}) {
  const [viewing, setViewing] = useState<'all' | 'craftsmen' | 'alumni'>('all');
  const sortByContributionCount = data.sort((a, b) => {
    const nameA = typeof a === 'string' ? a : (a.username ?? '');
    const nameB = typeof b === 'string' ? b : (b.username ?? '');

    const countA = contributionCount[nameA];
    const countB = contributionCount[nameB];

    return countB - countA;
  });

  const desc = useMemo(() => {
    if (viewing === 'all') {
      return 'Hover over a contributor to see their details';
    }
    if (viewing === 'craftsmen') {
      return 'Dwarves Craftsmen working diligently to empower the next innovation';
    }
    if (viewing === 'alumni') {
      return "Dwarves Alumni's work laid the foundation for those who come after";
    }
    return `Viewing all contributors`;
  }, [viewing]);

  return (
    <div className="border-t-border relative mb-10 flex flex-col items-center border-t">
      <div className="relative h-56 w-full overflow-hidden">
        <Image
          src="/assets/img/contributor-list-bg.jpg"
          layout="fill"
          alt=""
          className="no-zoom !m-0 w-full rounded-none object-cover"
        />
      </div>
      <div className="relative mx-auto w-full max-w-3xl px-3.5 md:px-0">
        <AvatarCluster
          authors={sortByContributionCount
            .filter(d => typeof d !== 'string')
            .slice(0, 8)}
        />
        <p className="mt-10 text-center text-4xl font-bold">
          Meet the people
          <br />
          behind our second brain
        </p>

        <Card className="mt-10">
          <CardHeader className="font-sans">
            <CardTitle className="flex items-center justify-between">
              <span>Contributors are sorted by their memos count</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs">
                    Viewing {viewing}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setViewing('all')}>
                    <SigmaIcon />
                    All
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewing('craftsmen')}>
                    <HammerIcon />
                    Dwarves Craftsmen
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewing('alumni')}>
                    <GraduationCapIcon />
                    Dwarves Alumni
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardTitle>
            <CardDescription>{desc}</CardDescription>
          </CardHeader>
          <ScrollArea className="relative">
            <CardContent className="flex flex-col items-start gap-y-1">
              <div className="bg-border absolute left-1/2 h-full w-px" />
              <div className="bg-border absolute left-4/5 h-full w-px" />
              {sortByContributionCount.map(d => {
                const name = typeof d === 'string' ? d : (d.username ?? '');
                return (
                  <Contributor
                    key={name}
                    data={d}
                    topCount={topCount}
                    count={contributionCount[name]}
                    latestWork={contributorLatestWork[name]}
                    viewing={viewing}
                  />
                );
              })}
            </CardContent>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}

export default ContributorList;

import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea, ScrollBar } from '../ui/scrollarea';
import { CompactContributorProfile } from '@/types/user';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '../ui/hover-card';
import { Avatar, AvatarImage } from '../ui/avatar';
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
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
import {
  GraduationCapIcon,
  HammerIcon,
  SigmaIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tab';
import {
  ListIcon,
  GridIcon,
  TwitterIcon,
  LinkedinIcon,
  FacebookIcon,
  GithubIcon,
} from 'lucide-react';

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

function ContributorGridCard({
  data,
  count,
}: {
  data: CompactContributorProfile | string;
  count: number;
}) {
  const isUnknown = typeof data === 'string';
  const name = typeof data === 'string' ? data : data.name;
  const username = typeof data === 'string' ? data : data.username;
  const socialProfiles = useMemo(() => {
    if (typeof data === 'string') return [];
    const profiles = [];
    if (data.github_url)
      profiles.push({ type: 'github', url: data.github_url });
    if (data.x_url) profiles.push({ type: 'twitter', url: data.x_url });
    if (data.linkedin_url)
      profiles.push({ type: 'linkedin', url: data.linkedin_url });
    if (data.facebook_url)
      profiles.push({ type: 'facebook', url: data.facebook_url });
    return profiles;
  }, [data]);

  const avatar = useMemo(() => {
    if (isUnknown) {
      return <Jdenticon value={data} size={40} />;
    }
    return <AvatarImage className="no-zoom !m-0" src={data.avatar} />;
  }, [data, isUnknown]);

  const memberType = typeof data === 'string' ? null : data.member_type;

  return (
    <Card className="relative flex flex-col items-center justify-between p-4 text-center shadow-none transition-shadow duration-200 hover:shadow-md">
      {memberType &&
        (memberType === 'alumni' || memberType === 'community') && (
          <Badge
            variant={memberType === 'alumni' ? 'default' : 'secondary'}
            className="absolute top-2 right-2 px-2 py-0.5 text-xs"
          >
            {memberType.charAt(0).toUpperCase() + memberType.slice(1)}
          </Badge>
        )}
      <Link
        href={`/contributor/${username.toLocaleLowerCase()}`}
        className="flex flex-col items-center"
      >
        <Avatar className="dark:bg-secondary mb-3 flex h-16 w-16 items-center justify-center border-2 bg-[#fff]">
          {avatar}
        </Avatar>
        <CardTitle className="text-md leading-tight font-bold">
          {name}
        </CardTitle>
        {!isUnknown && data.username && (
          <CardDescription className="text-muted-foreground mt-1 text-xs">
            @{data.username}
          </CardDescription>
        )}
      </Link>
      <div className="flex flex-col items-center space-y-4">
        <div className="flex gap-x-2">
          {socialProfiles.map(profile => {
            let IconComponent;
            switch (profile.type) {
              case 'github':
                IconComponent = GithubIcon;
                break;
              case 'twitter':
                IconComponent = TwitterIcon;
                break;
              case 'linkedin':
                IconComponent = LinkedinIcon;
                break;
              case 'facebook':
                IconComponent = FacebookIcon;
                break;
              default:
                return null;
            }
            return (
              <Link
                key={profile.url}
                href={profile.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {IconComponent && (
                  <IconComponent className="text-muted-foreground hover:text-foreground h-4 w-4" />
                )}
              </Link>
            );
          })}
        </div>
        <div className="text-muted-foreground flex items-center gap-x-1 text-xs">
          <SigmaIcon className="h-3 w-3 shrink-0" />
          <span className="shrink-0">{count || 0} memos</span>
        </div>
      </div>
    </Card>
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
}: {
  topCount: number;
  count: number;
  data: CompactContributorProfile | string;
  latestWork: { date: string; url: string; title: string };
}) {
  const isUnknown = typeof data === 'string';
  const name = typeof data === 'string' ? data : data.name;

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

  return (
    <div className={cn('relative flex w-full justify-start transition')}>
      <div
        className="absolute inset-0 rounded bg-[rgb(235,235,235)] dark:bg-[rgb(56,56,56)]"
        style={{ width: `${(count / topCount) * 100}%` }}
      />
      <HoverCard>
        <HoverCardTrigger asChild>
          <Link href={`/contributor/${name?.toLocaleUpperCase()}`}>
            <div className="relative flex cursor-pointer items-center justify-start gap-1.5 px-2 py-1">
              <Avatar className="dark:bg-secondary flex h-5 w-5 items-center justify-center border-2 bg-[#fff]">
                {avatar}
              </Avatar>
              <span className="shrink-0 text-sm">{name}</span>
            </div>
          </Link>
        </HoverCardTrigger>
        <HoverCardContent side="right" asChild>
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

function ContributorGrid({
  data,
  contributionCount,
  viewing,
  craftsmenDesc,
  alumniDesc,
  communityDesc,
}: {
  data: (CompactContributorProfile | string)[];
  contributionCount: Record<string, number>;
  viewing: 'all' | 'dwarves' | 'alumni' | 'community';
  craftsmenDesc: string;
  alumniDesc: string;
  communityDesc: string;
}) {
  const craftsmenWith10Memos = data.filter(
    d =>
      (contributionCount[typeof d !== 'string' ? (d.username ?? '') : ''] ??
        0) >= 10,
  );

  const theRest = data.filter(
    d =>
      typeof d !== 'string' && (contributionCount[d.username ?? ''] ?? 0) < 10,
  );

  const dwarves = data.filter(
    d =>
      typeof d !== 'string' &&
      d.member_type !== 'alumni' &&
      d.member_type !== 'community',
  );

  const alumni = data.filter(
    d => typeof d !== 'string' && d.member_type === 'alumni',
  );
  const community = data.filter(
    d => typeof d !== 'string' && d.member_type === 'community',
  );

  const renderGrid = (contributors: (CompactContributorProfile | string)[]) => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {contributors.map(d => {
        const name = typeof d === 'string' ? d : (d.username ?? '');
        return (
          <ContributorGridCard
            key={name}
            data={d}
            count={contributionCount[name]}
          />
        );
      })}
    </div>
  );

  if (viewing === 'all') {
    return (
      <div className="flex flex-col">
        <div className="mb-1 text-xl font-semibold">Craftsmen</div>
        <p className="text-muted-foreground mb-4 text-sm">{craftsmenDesc}</p>
        {renderGrid(craftsmenWith10Memos)}
        <div className="mt-10 mb-1 text-xl font-semibold">Contributors</div>
        <p className="text-muted-foreground mb-4 text-sm">
          The dedicated members who lay the foundation for our community
        </p>
        {renderGrid(theRest)}
      </div>
    );
  }
  if (viewing === 'dwarves') {
    return (
      <div className="flex flex-col">
        <div className="mb-1 text-xl font-semibold">Dwarves</div>
        <p className="text-muted-foreground mb-4 text-sm">{craftsmenDesc}</p>
        {renderGrid(dwarves)}
      </div>
    );
  }

  if (viewing === 'alumni') {
    return (
      <div className="flex flex-col">
        <div className="mb-1 text-xl font-semibold">Alumni</div>
        <p className="text-muted-foreground mb-4 text-sm">{alumniDesc}</p>
        {renderGrid(alumni)}
      </div>
    );
  }

  if (viewing === 'community') {
    return (
      <div className="flex flex-col">
        <div className="mb-1 text-xl font-semibold">Community</div>
        <p className="text-muted-foreground mb-4 text-sm">{communityDesc}</p>
        {renderGrid(community)}
      </div>
    );
  }
  return null; // Should not happen
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
  const router = useRouter();
  const { view: queryViewing } = router.query;

  const initialViewing = useMemo(() => {
    const validViews = ['dwarves', 'alumni', 'community'];
    if (typeof queryViewing === 'string' && validViews.includes(queryViewing)) {
      return queryViewing as 'dwarves' | 'alumni' | 'community';
    }
    return 'all';
  }, [queryViewing]);

  const [viewing, setViewing] = useState<
    'all' | 'dwarves' | 'alumni' | 'community'
  >(initialViewing);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');

  useEffect(() => {
    const validViews = ['dwarves', 'alumni', 'community'];
    if (typeof queryViewing === 'string' && validViews.includes(queryViewing)) {
      setViewing(queryViewing as 'dwarves' | 'alumni' | 'community');
    } else {
      setViewing('all');
    }
  }, [queryViewing]);

  const filteredData = useMemo(() => {
    const allNonAlumniCommunity = data.filter(
      d =>
        typeof d !== 'string' &&
        d.member_type !== 'alumni' &&
        d.member_type !== 'community',
    );
    const alumni = data.filter(
      d => typeof d !== 'string' && d.member_type === 'alumni',
    );
    const community = data.filter(
      d => typeof d !== 'string' && d.member_type === 'community',
    );

    if (viewing === 'all') {
      // For 'all' viewing, we combine craftsmenWith10Memos and theRest
      // The sorting will handle the order, but we need to ensure both groups are present.
      // For the purpose of filtering, we return the original data and let ContributorGrid handle the split.
      return data;
    }
    if (viewing === 'alumni') return alumni;
    if (viewing === 'community') return community;
    if (viewing === 'dwarves') return allNonAlumniCommunity; // Changed to include all non-alumni/non-community
    return data;
  }, [data, viewing, contributionCount]);

  const sortByContributionCount = data.sort((a, b) => {
    const nameA = typeof a === 'string' ? a : (a.username ?? '');
    const nameB = typeof b === 'string' ? b : (b.username ?? '');

    const countA = contributionCount[nameA];
    const countB = contributionCount[nameB];

    return countB - countA;
  });

  const sortByFilteredContributionCount = filteredData.sort((a, b) => {
    const nameA = typeof a === 'string' ? a : (a.username ?? '');
    const nameB = typeof b === 'string' ? b : (b.username ?? '');

    const countA = contributionCount[nameA];
    const countB = contributionCount[nameB];

    return countB - countA;
  });

  const desc = useMemo(() => {
    if (viewing === 'all') {
      return 'All Dwarves community members';
    }
    if (viewing === 'dwarves') {
      return 'Dwarves working diligently to empower the next innovation';
    }
    if (viewing === 'alumni') {
      return "Dwarves Alumni's work laid the foundation for those who come after";
    }
    if (viewing === 'community') {
      return 'Dwarves Community is a vibrant group of contributors who share their knowledge and skills';
    }
    return `Viewing all contributors`;
  }, [viewing]);

  return (
    <div className="border-t-border relative mb-10 flex flex-col items-center border-t font-serif">
      <div className="relative h-56 w-full overflow-hidden">
        <Image
          src="/assets/img/contributor-list-bg.jpg"
          layout="fill"
          alt=""
          className="no-zoom !m-0 w-full rounded-none object-cover"
        />
      </div>
      <div className="relative mx-auto w-full max-w-5xl px-3.5 md:px-0">
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

        <Tabs
          value={viewMode}
          onValueChange={value => setViewMode(value as 'list' | 'grid')}
          className="mt-10 w-full space-y-5"
        >
          <div className="flex items-center justify-between gap-x-2">
            <TabsList>
              <TabsTrigger value="grid" className="flex items-center gap-x-1">
                <GridIcon className="h-4 w-4" />
                Grid
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-x-1">
                <ListIcon className="h-4 w-4" />
                List
              </TabsTrigger>
            </TabsList>

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
                <DropdownMenuItem onClick={() => setViewing('dwarves')}>
                  <HammerIcon />
                  Dwarves
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewing('alumni')}>
                  <GraduationCapIcon />
                  Alumni
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewing('community')}>
                  <UsersIcon />
                  Community
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <TabsContent value="list" className="w-full">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>
                  Contributors are sorted by their memos count
                </CardTitle>
                <CardDescription>{desc}</CardDescription>
              </CardHeader>
              <ScrollArea className="relative">
                <CardContent className="flex flex-col items-start gap-y-1">
                  <div className="bg-border absolute left-1/2 h-full w-px" />
                  <div className="bg-border absolute left-4/5 h-full w-px" />
                  {sortByFilteredContributionCount.map(d => {
                    const name = typeof d === 'string' ? d : (d.username ?? '');
                    return (
                      <Contributor
                        key={name}
                        data={d}
                        topCount={topCount}
                        count={contributionCount[name]}
                        latestWork={contributorLatestWork[name]}
                      />
                    );
                  })}
                </CardContent>
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </Card>
          </TabsContent>
          <TabsContent value="grid" className="w-full">
            <ContributorGrid
              data={sortByFilteredContributionCount}
              contributionCount={contributionCount}
              viewing={viewing}
              craftsmenDesc={
                'Dwarves Craftsmen working diligently to empower the next innovation'
              }
              alumniDesc={
                "Dwarves Alumni's work laid the foundation for those who come after"
              }
              communityDesc={
                'Dwarves Community is a vibrant group of contributors who share their knowledge and skills'
              }
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default ContributorList;

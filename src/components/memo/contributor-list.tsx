import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { ScrollArea, ScrollBar } from '../ui/scrollarea';
import { MochiUserProfile } from '@/types/user';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '../ui/hover-card';
import { Avatar, AvatarImage } from '../ui/avatar';
import { useMemo } from 'react';
import Jdenticon from 'react-jdenticon';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts';
import { ChartConfig, ChartContainer } from '../ui/chart';
import BookOpenIcon from '../icons/BookOpenIcon';
import {
  Brain,
  FlaskConical,
  Hammer,
  Network,
  SigmaIcon,
  Waypoints,
} from 'lucide-react';
import Link from 'next/link';

const chartConfig = {
  point: {
    label: 'Points',
  },
} satisfies ChartConfig;

function getContributorName(data: MochiUserProfile | string) {
  if (typeof data === 'string') {
    return data;
  }

  if (data.associated_accounts && data.associated_accounts.length > 0) {
    // Look for github account
    const githubAccount = data.associated_accounts.find(
      account => account.platform === 'github',
    );
    if (githubAccount?.platform_metadata?.username) {
      return githubAccount.platform_metadata.username;
    }

    // Look for discord account
    const discordAccount = data.associated_accounts.find(
      account => account.platform === 'discord',
    );
    if (discordAccount?.platform_metadata?.username) {
      return discordAccount.platform_metadata.username;
    }

    // Look for twitter account
    const twitterAccount = data.associated_accounts.find(
      account => account.platform === 'twitter',
    );
    if (twitterAccount?.platform_metadata?.username) {
      return twitterAccount.platform_metadata.username;
    }
  }

  return data.profile_name;
}

type AspectData = { aspect: string; point: number };

const aspectIcon = {
  Technician: FlaskConical,
  Manager: Network,
  Operator: Waypoints,
  Consultant: Brain,
  Builder: Hammer,
};

function generateRandomAspectData() {
  const aspects = [
    'Technician',
    'Manager',
    'Operator',
    'Consultant',
    'Builder',
  ];
  const data: AspectData[] = aspects.map(aspect => ({
    aspect,
    point: Math.floor(Math.random() * 20) + 1, // Random number between 1 and 20
  }));

  // Find the aspect with the highest point value
  const topAspect = data.reduce(
    (prev, current) => (prev.point > current.point ? prev : current),
    data[0],
  );

  return { data, topAspect };
}

function Contributor({
  data,
  count,
  topCount,
  latestWork,
}: {
  topCount: number;
  count: number;
  data: MochiUserProfile | string;
  latestWork: { date: string; url: string; title: string };
}) {
  const isUnknown = typeof data === 'string';

  const avatar = useMemo(() => {
    if (isUnknown) {
      return <Jdenticon value={data} size={20} />;
    }

    return <AvatarImage className="no-zoom !m-0" src={data.avatar} />;
  }, [data, isUnknown]);

  // Generate random aspect data for the radar chart
  const { data: aspectData, topAspect } = useMemo(
    () => generateRandomAspectData(),
    [],
  );

  const Icon = aspectIcon[topAspect.aspect as keyof typeof aspectIcon];

  return (
    <div className="relative flex w-full justify-start">
      <div
        className="absolute inset-0 rounded bg-[rgb(235,235,235)] dark:bg-[rgb(56,56,56)]"
        style={{ width: `${(count / topCount) * 100}%` }}
      />
      <HoverCard>
        <HoverCardTrigger asChild>
          <div className="relative flex cursor-pointer items-center justify-start gap-2 px-2 py-1">
            <Avatar className="dark:bg-secondary flex h-5 w-5 items-center justify-center border-2 bg-[#fff]">
              {avatar}
            </Avatar>
            <span className="shrink-0 text-sm">{getContributorName(data)}</span>
          </div>
        </HoverCardTrigger>
        <HoverCardContent side="right" asChild>
          <div className="!bg-background flex flex-col !p-0">
            <div className="border-border mb-5 flex w-full items-start gap-x-2 border-b px-3 py-2">
              <Avatar className="dark:bg-secondary mt-1 flex h-9 w-9 items-center justify-center border-2 bg-[#fff]">
                {avatar}
              </Avatar>
              <div className="flex min-w-0 flex-col items-start">
                <span className="text-lg font-bold">
                  {getContributorName(data)}
                </span>
                <span className="text-muted-foreground flex w-full items-center gap-x-1 text-sm">
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="shrink-0">{topAspect.aspect}</span>
                </span>
                <div className="text-muted-foreground flex items-center gap-x-1 text-sm">
                  <SigmaIcon className="h-3 w-3 shrink-0" />
                  <span className="shrink-0">Total memos: {count}</span>
                </div>
                <span className="text-muted-foreground flex w-full items-center gap-x-1 text-sm">
                  <BookOpenIcon className="h-3 w-3 shrink-0" />
                  <span className="shrink-0">Latest: </span>
                  <Link className="truncate" href={latestWork.url}>
                    {latestWork.title}
                  </Link>
                </span>
              </div>
            </div>
            <ChartContainer config={chartConfig} className="">
              <RadarChart data={aspectData}>
                <PolarAngleAxis dataKey="aspect" />
                <PolarGrid />
                <Radar
                  dataKey="point"
                  fillOpacity={0.6}
                  className="fill-primary"
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
  data: (MochiUserProfile | string)[];
  contributionCount: Record<string, number>;
  contributorLatestWork: Record<
    string,
    { date: string; title: string; url: string }
  >;
  topCount: number;
}) {
  const sortByContributionCount = data.sort((a, b) => {
    const nameA = typeof a === 'string' ? a : getContributorName(a);
    const nameB = typeof b === 'string' ? b : getContributorName(b);

    const countA = contributionCount[nameA];
    const countB = contributionCount[nameB];

    return countB - countA;
  });
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
        <p className="mt-10 text-center text-4xl font-bold">
          Meet the people
          <br />
          behind our second brain
        </p>

        <Card className="mt-10 pb-0">
          <CardHeader className="font-sans">
            <CardTitle>
              Viewing contributors sorted by their contribution
            </CardTitle>
            <CardDescription>
              Hover over a contributor to see their details
            </CardDescription>
          </CardHeader>
          <ScrollArea className="relative">
            <CardContent className="flex max-h-[calc(100vh-36rem)] flex-col items-start gap-y-1">
              <div className="bg-border absolute left-1/2 h-full w-px" />
              <div className="bg-border absolute left-4/5 h-full w-px" />
              {sortByContributionCount.map(d => {
                return (
                  <Contributor
                    key={getContributorName(d)}
                    data={d}
                    topCount={topCount}
                    count={contributionCount[getContributorName(d)]}
                    latestWork={contributorLatestWork[getContributorName(d)]}
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

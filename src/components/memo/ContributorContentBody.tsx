import { IMemoItem } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tab';
import ContributorMemoTimeline from './contributor-memo-timeline';
import MemosByCategory from './MemosByCategory';
import MemoTimelineList from './MemoTimelineList';
import MemoMap from './MemoMap';
import { Activity } from '@/types';

interface ContributorContentBodyProps {
  data: IMemoItem[];
  aggregatedActivities: Activity[][][];
  memoCollectors: Record<string, Array<{ username: string; avatar?: string }>>;
}

function ContributorContentBody({
  data,
  aggregatedActivities,
  memoCollectors,
}: ContributorContentBodyProps) {
  const authorUsername = data[0]?.authors?.[0];
  return (
    <Tabs
      defaultValue="timeline"
      className="relative mx-auto w-full px-3.5 md:max-w-3xl md:px-0"
    >
      <TabsList className="mb-2">
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="recently-published">Recently</TabsTrigger>
        <TabsTrigger value="by-tag">By Tag</TabsTrigger>
        <TabsTrigger value="memo-map">Memo Map</TabsTrigger>
      </TabsList>
      <TabsContent value="timeline">
        <ContributorMemoTimeline
          data={aggregatedActivities}
          memoCollectors={memoCollectors}
        />
      </TabsContent>
      <TabsContent value="recently-published">
        <MemoTimelineList title="" data={data.slice(0, 15)} />
      </TabsContent>
      <TabsContent value="by-tag" className="-mt-3">
        <MemosByCategory data={data} />
      </TabsContent>
      <TabsContent value="memo-map">
        {authorUsername && (
          <MemoMap memos={data} authorUsername={authorUsername} />
        )}
      </TabsContent>
    </Tabs>
  );
}

export default ContributorContentBody;

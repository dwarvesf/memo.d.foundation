import { IMemoItem } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tab';
import ContributorMemoTimeline from './ContributorMemoTimeline';
import MemosByCategory from './MemosByCategory';
import MemoTimelineList from './MemoTimelineList';
import MemoMap from './MemoMap';

interface ContributorContentBodyProps {
  data: IMemoItem[];
  aggregatedMemos: IMemoItem[][][];
}

function ContributorContentBody({
  data,
  aggregatedMemos,
}: ContributorContentBodyProps) {
  const authorUsername = data[0]?.authors?.[0];
  return (
    <Tabs defaultValue="timeline" className="relative mx-auto w-full max-w-3xl">
      <TabsList className="mb-2">
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="recently-published">Recently Published</TabsTrigger>
        <TabsTrigger value="by-tag">By Tag</TabsTrigger>
        <TabsTrigger value="memo-map">Memo Map</TabsTrigger>
      </TabsList>
      <TabsContent value="timeline">
        <ContributorMemoTimeline data={aggregatedMemos} />
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

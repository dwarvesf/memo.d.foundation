import { IMemoItem } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tab';
import ContributorMemoTimeline from './ContributorMemoTimeline';
import MemosByCategory from './MemosByCategory';
import MemoTimelineList from './MemoTimelineList';

interface ContributorContentBodyProps {
  data: IMemoItem[];
  aggregatedMemos: IMemoItem[][][];
}

function ContributorContentBody({
  data,
  aggregatedMemos,
}: ContributorContentBodyProps) {
  return (
    <Tabs defaultValue="timeline" className="relative mx-auto w-full max-w-3xl">
      <TabsList className="mb-2">
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="recently-published">Recently Published</TabsTrigger>
        <TabsTrigger value="by-tag">By Tag</TabsTrigger>
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
    </Tabs>
  );
}

export default ContributorContentBody;

import { uppercaseSpecialWords } from '@/lib/utils';
import { Link, TwitterIcon, Tag } from 'lucide-react';

interface Props {
  githubData: any;
  contributorMemos: any;
  className?: string;
}

const ContributorHead = (props: Props) => {
  const { githubData, contributorMemos } = props;

  const tags = contributorMemos
    ?.flatMap((memo: any) => memo.tags)
    .reduce((acc: Record<string, number>, tag: string) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});
  const tagList =
    tags &&
    Object.entries(tags)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

  console.log('tagList', tagList);

  return (
    <div className="flex justify-between gap-4">
      <div>
        <h1 className="!my-2 !mb-0 text-4xl font-bold">
          {githubData?.name || githubData?.login}
        </h1>
        <a className="text-xl" href={githubData?.html_url}>
          {githubData?.login}
        </a>
        <p className="text-muted-foreground mt-1">{githubData?.bio}</p>
        <ul className="mt-2">
          {githubData?.blog && (
            <li>
              <Link className="text-muted-foreground mr-2 inline w-4" />
              <a
                href={githubData.blog}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {githubData.blog}
              </a>
            </li>
          )}
          {githubData?.twitter_username && (
            <li>
              <TwitterIcon className="text-muted-foreground mr-2 inline w-4" />
              <a
                href={`https://x.com/${githubData?.twitter_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                @{githubData.twitter_username}
              </a>
            </li>
          )}
          {tagList?.length > 0 && (
            <li>
              <Tag className="text-muted-foreground mr-2 inline w-4" />
              {tagList.slice(0, 5).map(tag => (
                <a
                  key={tag.name}
                  href={`/tags/${tag.name}`}
                  className="bg-muted hover:bg-muted/80 hover:text-primary dark:bg-border dark:text-foreground dark:hover:text-primary mr-2 inline-flex items-center rounded-md px-1.5 py-0.5 text-sm font-medium text-[#4b4f53]"
                >
                  {uppercaseSpecialWords(tag.name)}
                </a>
              ))}
            </li>
          )}
        </ul>
      </div>
      <div className="flex-none">
        <img
          src={githubData?.avatar_url}
          alt="Avatar"
          className="h-40 w-40 rounded-full"
        />
      </div>
    </div>
  );
};
export default ContributorHead;

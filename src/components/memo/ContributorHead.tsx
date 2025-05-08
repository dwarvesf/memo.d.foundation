import { uppercaseSpecialWords } from '@/lib/utils';
import { Link, TwitterIcon, Tag as TagIcon } from 'lucide-react';
import Tag from '../ui/tag';

interface Props {
  contributorMemos: any;
  className?: string;
  name?: string;
  githubId?: string;
  githubLink?: string;
  websiteLink?: string;
  discordId?: string;
  discordName?: string;
  twitterUserName?: string;
  bio?: string;
  avatarUrl?: string;
}

const ContributorHead = (props: Props) => {
  const {
    bio,
    githubId,
    name,
    githubLink,
    websiteLink,
    twitterUserName,
    contributorMemos,
    avatarUrl,
  } = props;

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
      .sort((a, b) => (b.count as number) - (a.count as number));

  return (
    <div className="flex justify-between gap-4">
      <div>
        <div className="flex justify-between">
          <div>
            <h1 className="!my-2 !mb-0 text-4xl font-bold">
              {name || githubId}
            </h1>
            <a className="text-xl" href={githubLink}>
              {githubId}
            </a>
            <p className="text-muted-foreground mt-1">{bio}</p>
          </div>

          <div className="block flex-none sm:hidden">
            <img
              src={avatarUrl}
              alt="Avatar"
              className="h-16 w-16 rounded-full"
            />
          </div>
        </div>
        <div className="mt-2">
          {websiteLink && (
            <div>
              <Link className="text-muted-foreground mr-2 inline w-4" />
              <a
                href={websiteLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {websiteLink}
              </a>
            </div>
          )}
          {twitterUserName && (
            <div>
              <TwitterIcon className="text-muted-foreground mr-2 inline w-4" />
              <a
                href={`https://x.com/${twitterUserName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                @{twitterUserName}
              </a>
            </div>
          )}
          {tagList?.length > 0 && (
            <div>
              <TagIcon className="text-muted-foreground mr-2 inline w-4" />
              {tagList.slice(0, 5).map((tag: any) => (
                <Tag
                  key={tag.name}
                  href={`/tags/${tag.name}`}
                  className="mr-2 text-sm"
                >
                  {uppercaseSpecialWords(tag.name)}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="hidden flex-none sm:block">
        <img src={avatarUrl} alt="Avatar" className="h-40 w-40 rounded-full" />
      </div>
    </div>
  );
};
export default ContributorHead;

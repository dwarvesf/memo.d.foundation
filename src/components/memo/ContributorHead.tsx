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
    <div className="border-t-border relative mb-10 flex flex-col items-center border-t">
      <div className="h-56 w-full overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1511884642898-4c92249e20b6?q=80&w=4740&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          className="no-zoom !m-0 w-full object-cover"
        />
      </div>
      <div className="flex w-full max-w-3xl justify-between">
        <div className="flex flex-col">
          <h1 className="!my-6 !mb-0 text-4xl font-bold">{name || githubId}</h1>
          <a className="text-xl" href={githubLink}>
            {githubId}
          </a>
          <p className="text-muted-foreground mt-1">{bio}</p>
          <div className="mt-2 gap-1">
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
        <img
          src={avatarUrl}
          alt="Avatar"
          className="no-zoom mx-0 !-mt-12 h-40 w-40 rounded-full border-8 border-[var(--background)]"
        />
      </div>
    </div>
  );
};
export default ContributorHead;

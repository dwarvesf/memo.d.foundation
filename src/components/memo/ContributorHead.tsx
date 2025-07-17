import { uppercaseSpecialWords } from '@/lib/utils';
import { Link, TwitterIcon, Tag as TagIcon } from 'lucide-react';
import Tag from '../ui/tag';
import Image from 'next/image';

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
  showClaimProfile?: boolean;
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
    showClaimProfile = false,
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
      <div className="relative h-56 w-full overflow-hidden">
        <Image
          src="/assets/img/contributor-bg.jpg"
          layout="fill"
          alt=""
          className="no-zoom !m-0 w-full rounded-none object-cover"
        />
      </div>
      <div className="relative flex w-full flex-col-reverse justify-between px-3.5 md:max-w-3xl md:flex-row md:px-0">
        <div className="flex w-full flex-col">
          <h1 className="!my-3 !mb-0 !text-3xl font-bold md:!my-6 md:!mb-0 md:!text-4xl">
            {name || githubId}
          </h1>
          <a className="text-xl" href={githubLink}>
            {githubId}
          </a>
          <p className="text-muted-foreground mt-1">{bio}</p>
          <div className="mt-2 gap-1">
            {websiteLink && (
              <div className="flex whitespace-nowrap">
                <Link className="text-muted-foreground mr-2 inline w-4 shrink-0" />
                <a
                  href={websiteLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary min-w-0 truncate hover:underline"
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
              <div className="mt-2 flex">
                <TagIcon className="text-muted-foreground mr-2 inline w-4 shrink-0" />
                <div className="flex flex-wrap gap-2">
                  {tagList.slice(0, 5).map((tag: any) => (
                    <Tag
                      key={tag.name}
                      href={`/tags/${tag.name}`}
                      className="text-sm"
                    >
                      {uppercaseSpecialWords(tag.name)}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mx-0 !-mt-12 flex h-30 w-30 shrink-0 items-center justify-center overflow-hidden rounded-full border-6 border-[var(--background)] bg-[var(--background)] md:h-40 md:w-40 md:border-8">
          <img
            src={avatarUrl}
            alt="Avatar"
            className="no-zoom !m-0 w-full object-cover"
          />
        </div>
      </div>
      {showClaimProfile ? (
        <div className="relative mt-2 flex w-full flex-col-reverse justify-between px-3.5 md:max-w-3xl md:flex-row md:px-0">
          <div className="mt-4 w-full rounded-xl bg-[var(--primary-color-lighten)] p-4">
            <div className="flex items-center text-lg font-bold">
              Claim your profile
            </div>
            <p className="text-foreground mt-2">
              Your contributions to our journey matter. Claim your onchain
              profile in our Discord server.
            </p>
            <p className="text-foreground">
              Your connection is vital infrastructure for our evolution into a
              protocol, connecting you to a wider network of like-minded
              individuals, regardless of your current relationship with Dwarves.
            </p>
            <button
              onClick={() =>
                window.open('https://discord.com/invite/dfoundation', '_blank')
              }
              className="mt-4 w-full cursor-pointer rounded-full bg-black py-2 font-semibold text-white transition-all duration-100 hover:bg-black/80"
            >
              Get verified
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
export default ContributorHead;

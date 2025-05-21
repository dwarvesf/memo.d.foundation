import { useThemeContext } from '@/contexts/theme';
import { ActivityCalendar } from 'react-activity-calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '../ui/dropdown';
import { Button } from '../ui/button';
import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {
  eachDayOfInterval,
  endOfYear,
  format,
  formatISO,
  startOfYear,
} from 'date-fns';

interface ContributionActivityCalendarProps {
  data: Record<
    string,
    Array<{
      date: string;
      count: number;
      level: number;
    }>
  >;
}

const getEmptyCurrentYear = () => {
  const yearStart = startOfYear(new Date());
  const yearEnd = endOfYear(new Date());

  const days = eachDayOfInterval({
    start: yearStart,
    end: yearEnd,
  });

  const res = [];

  // Generate array of every day for this year with counts and levels
  for (let i = 0; i < days.length; i++) {
    res.push({
      date: formatISO(days[i], { representation: 'date' }),
      count: 0,
      level: 0,
    });
  }

  return res;
};

function ContributionActivityCalendar(
  props: ContributionActivityCalendarProps,
) {
  const { data } = props;
  const { isDark } = useThemeContext();
  const [year, setYear] = useState(
    Object.keys(data).sort((a, b) => b.localeCompare(a))[0],
  );

  return (
    <TooltipProvider>
      <div className="mx-auto mb-10 flex w-full max-w-3xl flex-col gap-y-2 px-3.5 md:px-0">
        <div className="flex items-center justify-between">
          <span className="text-base">Activity</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                <CalendarIcon className="!h-3 !w-3" />
                Viewing {year}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {Object.keys(data)
                .sort((a, b) => b.localeCompare(a))
                .map(year => (
                  <DropdownMenuItem key={year} onClick={() => setYear(year)}>
                    {year}
                    <DropdownMenuShortcut>
                      &#8721;
                      {data[year].reduce(
                        (acc, activity) => acc + activity.count,
                        0,
                      )}
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="border-border relative rounded-lg border px-4 py-2 pb-2 md:py-1 md:[&_svg]:w-full">
          <ActivityCalendar
            data={data[year] || getEmptyCurrentYear()}
            colorScheme={isDark ? 'dark' : 'light'}
            renderBlock={(block, activity) => {
              if (!activity.count) return block;
              return (
                <Tooltip>
                  <TooltipTrigger asChild>{block}</TooltipTrigger>
                  <TooltipContent
                    arrowClassName="!bg-muted-foreground !fill-muted-foreground"
                    className="!bg-muted-foreground !text-muted-foreground-foreground rounded-lg p-2 text-center text-xs font-medium shadow-md"
                    sideOffset={-5}
                  >
                    +{activity.count} new memos on{' '}
                    {format(activity.date, 'MMM do')}
                  </TooltipContent>
                </Tooltip>
              );
            }}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

export default ContributionActivityCalendar;

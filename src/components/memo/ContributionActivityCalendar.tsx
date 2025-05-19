import { useThemeContext } from '@/contexts/theme';
import { ActivityCalendar } from 'react-activity-calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown';
import { Button } from '../ui/button';
import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
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

function ContributionActivityCalendar(
  props: ContributionActivityCalendarProps,
) {
  const { data } = props;
  const { isDark } = useThemeContext();
  const [year, setYear] = useState(
    Object.keys(data).sort((a, b) => b.localeCompare(a))[0],
  );

  return (
    <div className="mx-auto mb-10 flex w-full max-w-3xl flex-col gap-y-2">
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
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="border-border relative rounded-lg border px-4 py-1 pb-2 [&_svg]:w-full">
        <ActivityCalendar
          data={data[year]}
          colorScheme={isDark ? 'dark' : 'light'}
        />
      </div>
    </div>
  );
}

export default ContributionActivityCalendar;

import { useThemeContext } from '@/contexts/theme';
import { ActivityCalendar } from 'react-activity-calendar';

interface ContributionActivityCalendarProps {
  data: {
    date: string;
    count: number;
    level: number;
  }[];
}

function ContributionActivityCalendar(
  props: ContributionActivityCalendarProps,
) {
  const { data } = props;
  const { isDark } = useThemeContext();
  return (
    <div className="border-border relative mx-auto mb-10 w-full max-w-3xl rounded-lg border px-4 py-1 pb-2 [&_svg]:w-full">
      <ActivityCalendar data={data} colorScheme={isDark ? 'dark' : 'light'} />
    </div>
  );
}

export default ContributionActivityCalendar;

import argparse
import os
import re
from datetime import datetime, timedelta

def combine_transcripts(files):
    combined_transcript = []

    # Create a list to store the timestamped lines
    timestamped_lines = []

    for file in files:
        with open(file, 'r') as f:
            vtt_content = f.read()

        # Extract the filename (without extension) as the speaker's name
        speaker = os.path.basename(file).split('.')[0]

        # Extract the timestamped lines from the VTT content
        lines = vtt_content.split('\n')
        for i in range(len(lines)):
            if '-->' in lines[i]:
                timestamp = lines[i]
                text = lines[i+1]
                timestamp_parts = timestamp.split('-->')
                if len(timestamp_parts) == 2:
                    start_time, end_time = timestamp_parts
                    time_parts = start_time.strip().split(':')
                    if len(time_parts) == 2:
                        minutes, seconds = time_parts
                        hours = 0
                    else:
                        hours, minutes, seconds = time_parts
                    seconds, milliseconds = seconds.split('.')
                    start_time = datetime.strptime(f"{hours}:{minutes}:{seconds}", '%H:%M:%S') + timedelta(milliseconds=int(milliseconds))
                    timestamped_lines.append((start_time, speaker, text.strip()))

    # Sort the timestamped lines by timestamp
    timestamped_lines.sort(key=lambda x: x[0])

    # Combine the sorted lines into a single string
    for start_time, speaker, text in timestamped_lines:
        time_only = start_time.strftime('%H:%M:%S')
        labeled_text = f'{time_only}: {speaker}: {text}\n'
        combined_transcript.append(labeled_text)

    combined_transcript_str = ''.join(combined_transcript)
    return combined_transcript_str

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Combine multiple VTT transcripts')
    parser.add_argument('files', nargs='+', help='VTT files to combine')
    parser.add_argument('-o', '--output', help='Output file (optional)')

    args = parser.parse_args()

    combined_transcript_str = combine_transcripts(args.files)

    print(combined_transcript_str)

    if args.output:
        with open(args.output, 'w') as f:
            f.write(combined_transcript_str)
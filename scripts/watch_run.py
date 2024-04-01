import os
import sys
import time
import subprocess
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler


class FileChangeHandler(FileSystemEventHandler):
    def __init__(self):
        super().__init__()
        self.last_modified_time = {}
        self.processed_files = {}

    def on_modified(self, event):
        if event.is_directory:
            return

		# Get the file path and relative path
        file_path = event.src_path
        relative_path = os.path.join(directory, os.path.relpath(file_path, directory))
		
		# Get the current modified time of the file
        current_modified_time = os.path.getmtime(file_path)

        if relative_path.endswith(".md") and (
            relative_path not in self.last_modified_time
            or self.last_modified_time[relative_path] != current_modified_time
        ):
            self.last_modified_time[relative_path] = current_modified_time

			# Check if the file has been processed in the last second
            if (
                relative_path in self.processed_files
                and time.time() - self.processed_files[relative_path] < 1
            ):
                return
			
			# Update the processed_files dictionary
            self.processed_files[relative_path] = time.time()

			# Run the image processor and markdown exporter
            subprocess.run(
                ["python", "scripts/single_image_processor.py", relative_path]
            )
            subprocess.run(
                [
                    "python",
                    "scripts/single_export_markdown.py",
                    relative_path,
                    export_directory,
                ]
            )


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(
            "Please provide the path to the Markdown file as an argument as well as an export path."
        )
        sys.exit(1)

    directory = sys.argv[1]
    export_directory = sys.argv[2]

    event_handler = FileChangeHandler()
    observer = Observer()
    observer.schedule(event_handler, directory, recursive=True)
    observer.start()

    # Start the hugo server in a subprocess
    hugo_process = subprocess.Popen(["hugo", "-DEF", "--logLevel", "error", "server"])

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        hugo_process.terminate()

    observer.join()
    hugo_process.wait()

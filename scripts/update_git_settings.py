import subprocess

def check_git_config_setting(setting):
    # Get the list of all remote.origin.fetch settings
    result = subprocess.run(['git', 'config', '--get-all', 'remote.origin.fetch'], stdout=subprocess.PIPE)
    # Decode the result and split into lines
    fetch_settings = result.stdout.decode('utf-8').strip().split('\n')
    # Check if the setting is already in the config
    return setting in fetch_settings

def add_git_config_setting(setting):
    # Add the setting using git config --add
    subprocess.run(['git', 'config', '--add', 'remote.origin.fetch', setting])

# The setting we want to check and possibly add
refspec_setting = '^refs/heads/gh-pages'

# Check if the setting is already applied
if not check_git_config_setting(refspec_setting):
    print('Setting not found. Excluding gh-pages from git fetch...')
    add_git_config_setting(refspec_setting)
else:
    print('Setting already applied. Skipping excluding gh-pages from git fetch...')


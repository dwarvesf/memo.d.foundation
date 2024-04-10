import subprocess


def check_git_config_setting(section, key):
    # Get the list of all settings in a given section
    result = subprocess.run(
        ["git", "config", "--get-all", f"{section}.{key}"], stdout=subprocess.PIPE
    )
    # Decode the result and split into lines
    fetch_settings = result.stdout.decode("utf-8").strip().split("\n")
    # Check if the setting is already in the config
    return fetch_settings


def add_git_config_setting(section, key, value):
    # Add the setting using git config --add
    subprocess.run(["git", "config", "--add", f"{section}.{key}", value])


# The setting we want to check and possibly add for remote.origin.fetch
refspec_setting = "^refs/heads/gh-pages"

# Check if the setting is already applied for remote.origin.fetch
if refspec_setting not in check_git_config_setting("remote.origin", "fetch"):
    print("Setting not found. Excluding gh-pages from git fetch...")
    add_git_config_setting("remote.origin", "fetch", refspec_setting)
else:
    print("Setting already applied. Skipping excluding gh-pages from git fetch...")

# The setting we want to check and possibly add for submodule.fetchJobs
submodule_section = "submodule"
submodule_key = "fetchJobs"
submodule_value = "10"

# Check if the setting is already applied for submodule.fetchJobs
if submodule_value not in check_git_config_setting(submodule_section, submodule_key):
    print(
        f"Setting not found. Setting {submodule_section}.{submodule_key} to {submodule_value}..."
    )
    add_git_config_setting(submodule_section, submodule_key, submodule_value)
else:
    print(
        f"Setting already applied. Skipping setting {submodule_section}.{submodule_key} to {submodule_value}..."
    )

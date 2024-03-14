#!/usr/bin/expect -f

# Make sure the expect command is available
set timeout 10

# Check if credentials are already stored
spawn git-credential-manager github list
expect {
    -re "\n(.*)" {
        # Credentials found - skip login
        puts "Credentials already exist. Skipping login."
    } 
    default {
        # No credentials found or error - proceed with login
        spawn git-credential-manager github login --no-ui
        sleep 0.5
        expect "option (enter for default): "
        send "\r"
        interact
    }
}

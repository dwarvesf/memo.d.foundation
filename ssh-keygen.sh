#!/bin/bash

# Check if the user has an ssh key
if [ -f ~/.ssh/id_rsa.pub ]; then
  echo "You already have an ssh key."
else
  echo "You don't have an ssh key. Generating one for you."
  # Generate an ssh key with the user's email as the comment
  read -p "Enter your email: " email
  ssh-keygen -t rsa -b 4096 -C "$email" -f ~/.ssh/id_rsa -N ""
fi

# Output the public key
echo "Your public key is:"
cat ~/.ssh/id_rsa.pub
cat ~/.ssh/id_rsa.pub | pbcopy

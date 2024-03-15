#!/bin/bash

# update submodule branches recursively to main or master
git submodule foreach --recursive 'git checkout main || git checkout master' 

# Update submodules recursively (in case they're not up-to-date)
git submodule update --remote --recursive

#!/bin/bash

# update submodule branches recursively to branch set on .gitmodules
git submodule foreach --recursive 'git checkout $(git config -f $toplevel/.gitmodules submodule.$name.branch || echo main)'

# Update submodules recursively (in case they're not up-to-date)
git submodule update --remote --recursive

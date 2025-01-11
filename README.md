# vim-shareedit

## Overview

A Neovim plugin that shares open files and cursor positions between Neovim and VSCode

## Motivation
I have been using Neovim for a long time, but recently I've started using editors like Cursor and Cline more frequently, which means I often need to switch between different editors for development and testing.

However, except for specific features like AI-related functionality, using Neovim is still the most efficient for me, so I primarily use Neovim for reading code.

As I continued working this way, frequently switching between Neovim and other editors became cumbersome.

Therefore, to make switching between Neovim and VSCode smoother, I created this plugin that shares files and cursor positions between Neovim and VSCode.

## Installation
Install with your preferred plugin manager.


### vim-plug
```
Plug 'vim-denops/denops.vim'
Plug 'kbwo/vim-shareedit'
```

## Usage

In Vim
```
:ShareEdit <PORT>
```

In VSCode, you can connect to vim-shareedit by `Connect to vim-shareedit` command from command palette (Cmd/Ctrl+Shift+P).
See [VSCode Extension](https://marketplace.visualstudio.com/items?itemName=kbwo.shareedit) for more details.

## TODO

- [x] Share cursor position
- [ ] Share visual mode selection range
- [ ] Share unsaved file edits


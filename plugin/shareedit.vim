if exists('g:loaded_shareedit')
  finish
endif
let g:loaded_shareedit = 1

function! SyncCursorPosition()
  if !denops#plugin#is_loaded('shareedit')
    return
  endif
  if mode() !=# 'v' && mode() !=# 'V' && mode() !=# 'i' && mode() !=# 'I'
    " Only sync if position changed
    call denops#notify("shareedit", "syncCursorPos", [])
  endif 
endfunction

function! SyncVisualSelection()
  if denops#plugin#is_loaded('shareedit')
    return
  endif
  if mode() ==# 'v' || mode() ==# 'V'
    let [startLine, startCol] = getpos("v")[1:2]
    let [endLine, endCol] = getpos(".")[1:2]
    call denops#notify("shareedit", "syncSelectionPos", [startLine, startCol, endLine, endCol + 1])
  endif 
endfunction

autocmd CursorMoved,VimResized * call SyncVisualSelection()
autocmd CursorMoved,CursorHold,InsertLeave * call SyncCursorPosition()

command! -nargs=1 ShareEdit call denops#notify("shareedit", "run", [<args>])

function! SyncCursorPosition()
  if denops#server#status() !=# 'running'
    return
  endif
  if mode() !=# 'v' && mode() !=# 'V' && mode() !=# 'i' && mode() !=# 'I'
    let line = line('.')
    let col = col('.')
    
    " Only sync if position changed
    call denops#notify("shareedit", "syncCursorPos", [line, col])
  endif 
endfunction

function! EchoVisualSelection()
  if denops#server#status() !=# 'running'
    return
  endif
  if mode() ==# 'v' || mode() ==# 'V'
    let [startLine, startCol] = getpos("v")[1:2]
    let [endLine, endCol] = getpos(".")[1:2]
    call denops#notify("shareedit", "syncSelectionPos", [startLine, startCol, endLine, endCol + 1])
  endif 
endfunction

autocmd CursorMoved,VimResized * call EchoVisualSelection()
autocmd CursorMoved,CursorHold,InsertLeave * call SyncCursorPosition()

command! -nargs=1 ShareEdit call denops#notify("shareedit", "setPort", [<args>])

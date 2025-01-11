function! GetCursorPosition()
  if mode() !=# 'v' && mode() !=# 'V' && mode() !=# 'i' && mode() !=# 'I'
    call denops#notify("shareedit", "syncCursorPos", [])
  endif 
endfunction
function! EchoVisualSelection()
  if mode() ==# 'v' || mode() ==# 'V'
    let [startLine, startCol] = getpos("v")[1:2]
    let [endLine, endCol] = getpos(".")[1:2]
    call denops#notify("shareedit", "syncSelectionPos", [startLine, startCol, endLine, endCol + 1])
  endif 
endfunction

autocmd CursorMoved,VimResized * call EchoVisualSelection()
autocmd CursorMoved * call GetCursorPosition()

command! -nargs=1 ShareEdit call denops#notify("shareedit", "setPort", [<args>])

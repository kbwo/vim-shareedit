let s:plugin_name = 'shareedit'

function! shareedit#sync_cursor_position() abort
  if !denops#plugin#is_loaded(s:plugin_name)
    return
  endif
  if mode() !=# 'v' && mode() !=# 'V' && mode() !=# 'i' && mode() !=# 'I'
    " Only sync if position changed
    call denops#notify(s:plugin_name, "syncCursorPos", [])
  endif 
endfunction

function! shareedit#sync_visual_selection() abort
  if !denops#plugin#is_loaded(s:plugin_name)
    return
  endif
  if mode() ==# 'v' || mode() ==# 'V'
    let [startLine, startCol] = getpos("v")[1:2]
    let [endLine, endCol] = getpos(".")[1:2]
    call denops#notify(s:plugin_name, "syncSelectionPos", [startLine, startCol, endLine, endCol + 1])
  endif 
endfunction

function! shareedit#start() abort
  if !denops#plugin#is_loaded(s:plugin_name)
    return
  endif
  call denops#notify(s:plugin_name, "start", [])
endfunction

function! shareedit#stop() abort
  if !denops#plugin#is_loaded(s:plugin_name)
    return
  endif
  call denops#notify(s:plugin_name, "stop", [])
endfunction 
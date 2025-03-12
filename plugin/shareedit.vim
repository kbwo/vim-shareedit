if exists('g:loaded_shareedit')
  finish
endif
let g:loaded_shareedit = 1

autocmd CursorMoved,VimResized * call shareedit#sync_visual_selection()
autocmd CursorMoved,CursorHold,InsertLeave * call shareedit#sync_cursor_position()

command! ShareEditStart call shareedit#start()
command! ShareEditStop call shareedit#stop()

(() => {
  'use strict';
  function currentView(){return document.querySelector('[data-view-button].is-active')?.getAttribute('data-view-button')||''}
  function sync(){const shelf=currentView()==='shelf',toolbar=document.querySelector('[data-catalog-toolbar]'),bulk=document.querySelector('[data-cat-bulk]');if(toolbar)toolbar.hidden=!shelf;if(bulk&&!shelf)bulk.hidden=true}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{sync();document.querySelectorAll('[data-view-button]').forEach(button=>button.addEventListener('click',()=>setTimeout(sync,0)));window.addEventListener('popstate',()=>setTimeout(sync,0))},160));
})();

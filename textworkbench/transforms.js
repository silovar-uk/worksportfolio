/* Pure transformations: no DOM, storage, or networking. */
(function(root){'use strict';
const definitions={
spaces:['連続空白を1個へ',/[ \u3000]{2,}/g,' '],
tabs:['Tab削除',/\t/g,''],
trim:['行頭・行末空白削除',/^[ \t\u3000]+|[ \t\u3000]+$/gm,''],
blank:['空行削除',null,null],
collapse:['連続空行を1行へ',/\n(?:[ \t\u3000]*\n){2,}/g,'\n\n'],
newlines:['改行を半角スペースへ',/\r\n|\r|\n/g,' '],
width:['全角英数字を半角へ',/[Ａ-Ｚａ-ｚ０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0)]};
function transform(text,id){const d=definitions[id];if(!d)throw Error('Unknown transform');let count=0;let value=text;if(id==='blank'){const lines=text.split('\n');value=lines.filter(line=>{if(/^[ \t\u3000]*$/.test(line)){count++;return false}return true}).join('\n')}else value=text.replace(d[1],m=>{count++;return typeof d[2]==='function'?d[2](m):d[2]});return {text:value,count,label:d[0]}}
root.WorkbenchTransforms={definitions,transform};if(typeof module!=='undefined')module.exports=root.WorkbenchTransforms;
})(typeof window==='undefined'?globalThis:window);

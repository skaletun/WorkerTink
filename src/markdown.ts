import {getShift,shiftLabel,type State} from './core.ts';

export function safeInline(s:string){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
export function isMarkdownTableRow(line:string){return /^\s*\|?\s*[^|]+(?:\|[^|]+)+\s*\|?\s*$/.test(line)}
export function isMarkdownTableSeparator(line:string){return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)}
export function markdownCells(line:string){return line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(x=>x.trim())}
export function inlineMd(s:string){return s.replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_]+)__/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>').replace(/_([^_]+)_/g,'<em>$1</em>').replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,'<a href="$2" target="_blank" rel="noreferrer">$1</a>')}
export function markdownTableToHtml(rows:string[]){
 const header=markdownCells(rows[0]);const body=rows.slice(2).map(markdownCells);let out='<div class="md-table-wrap"><table><thead><tr>';
 header.forEach(cell=>{out+=`<th>${inlineMd(safeInline(cell))}</th>`});out+='</tr></thead>';
 if(body.length){out+='<tbody>';body.forEach(row=>{out+='<tr>';header.forEach((_,i)=>{out+=`<td>${inlineMd(safeInline(row[i]??''))}</td>`});out+='</tr>'});out+='</tbody>'}
 return out+'</table></div>';
}
export function markdownToHtml(markdown:string){
 const lines=markdown.split('\n');let html='',inCode=false,code='';
 for(let i=0;i<lines.length;i++){
  const raw=lines[i];
  if(raw.trim().startsWith('```')){if(inCode){html+=`<pre><code>${safeInline(code)}</code></pre>`;code='';inCode=false}else inCode=true;continue}
  if(inCode){code+=raw+'\n';continue}
  const next=lines[i+1]??'';
  if(isMarkdownTableRow(raw)&&isMarkdownTableSeparator(next)){const rows:string[]=[];let j=i;while(j<lines.length&&isMarkdownTableRow(lines[j])){rows.push(lines[j]);j++}html+=markdownTableToHtml(rows);i=j-1;continue}
  const line=safeInline(raw);
  if(/^#{1,6} /.test(raw)){const n=(raw.match(/^#+/)||['#'])[0].length;html+=`<h${n}>${inlineMd(line.replace(/^#{1,6} /,''))}</h${n}>`;continue}
  if(/^[-*] /.test(raw)){html+=`<ul><li>${inlineMd(line.slice(2))}</li></ul>`;continue}
  if(/^\d+\. /.test(raw)){html+=`<ol><li>${inlineMd(line.replace(/^\d+\. /,''))}</li></ol>`;continue}
  if(/^> /.test(raw)){html+=`<blockquote>${inlineMd(line.slice(2))}</blockquote>`;continue}
  if(/^---+$/.test(raw.trim())){html+='<hr/>';continue}
  if(raw.trim())html+=`<p>${inlineMd(line)}</p>`;
 }
 if(inCode)html+=`<pre><code>${safeInline(code)}</code></pre>`;
 return html;
}

export function htmlToMarkdown(root:HTMLElement){
 const out:string[]=[];const esc=(s:string)=>s.replace(/\u00a0/g,' ');
 const inline=(node:Node):string=>{
  if(node.nodeType===Node.TEXT_NODE)return esc(node.textContent||'');
  if(node.nodeType!==Node.ELEMENT_NODE)return '';
  const el=node as HTMLElement,tag=el.tagName.toLowerCase(),content=Array.from(el.childNodes).map(inline).join('');
  if(tag==='strong'||tag==='b')return `**${content}**`;if(tag==='em'||tag==='i')return `*${content}*`;if(tag==='code')return `\`${content}\``;if(tag==='a')return `[${content}](${(el as HTMLAnchorElement).getAttribute('href')||''})`;if(tag==='br')return '\n';return content;
 };
 const walk=(node:Node)=>{
  if(node.nodeType===Node.TEXT_NODE){const t=esc(node.textContent||'');if(t.trim())out.push(t);return}
  if(node.nodeType!==Node.ELEMENT_NODE)return;
  const el=node as HTMLElement,tag=el.tagName.toLowerCase();
  if(/^h[1-6]$/.test(tag)){out.push(`${'#'.repeat(Number(tag[1]))} ${inline(el).trim()}`);return}
  if(tag==='ul'||tag==='ol'){Array.from(el.children).forEach((li,i)=>out.push(tag==='ul'?`- ${inline(li).trim()}`:`${i+1}. ${inline(li).trim()}`));out.push('');return}
  if(tag==='blockquote'){out.push(inline(el).split('\n').map(x=>`> ${x}`.trimEnd()).join('\n'));out.push('');return}
  if(tag==='pre'){const code=el.querySelector('code')?.textContent??el.textContent??'';out.push(`\`\`\`\n${code.replace(/\n$/,'')}\n\`\`\``);out.push('');return}
  if(tag==='hr'){out.push('---','');return}
  if(tag==='div'&&el.querySelector('table')){Array.from(el.children).forEach(walk);return}
  if(tag==='table'){
   const rows=Array.from(el.querySelectorAll('tr')).map(tr=>Array.from(tr.children).map(c=>inline(c).trim()));
   if(rows.length){out.push(`| ${rows[0].join(' | ')} |`);out.push(`| ${rows[0].map(()=> '---').join(' | ')} |`);rows.slice(1).forEach(r=>out.push(`| ${r.join(' | ')} |`));out.push('')}
   return;
  }
  if(tag==='p'||tag==='div'){const value=inline(el).trim();if(value)out.push(value);out.push('');return}
  if(tag==='li')return;
  Array.from(el.childNodes).forEach(walk);
 };
 Array.from(root.childNodes).forEach(walk);return out.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}

export function parseNotesMarkdown(text:string){
 const notes:Record<string,string>={};const matches=[...text.matchAll(/^## SHIFT:\s*(\d{4}-\d{2}-\d{2})(?:\s+—.*)?\s*$/gmi)];
 if(matches.length){matches.forEach((m,i)=>{const body=text.slice(m.index!+m[0].length,matches[i+1]?.index??text.length).trim();notes[m[1]]=body.replace(/^\n+/,'').trimEnd()});return notes}
 const single=text.match(/^# WorkerTink[^\n]*\n+\*\*Дата:\*\*\s*(\d{4}-\d{2}-\d{2})[^\n]*\n+\*\*Смена:\*\*[^\n]*\n+(.*)$/is);if(single)notes[single[1]]=single[2].trimEnd();return notes;
}
export function notesExport(state:State,dates:string[]){let out='# WorkerTink — заметки по сменам\n\n';for(const date of dates){const note=state.shiftNotes[date];if(!note?.trim())continue;out+=`## SHIFT: ${date} — ${shiftLabel(state.shiftOverrides[date] ?? getShift(state,new Date(`${date}T12:00:00`)))}\n\n${note.trimEnd()}\n\n`; }return out.trimEnd()+'\n';}

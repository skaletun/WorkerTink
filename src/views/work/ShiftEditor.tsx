import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {State,getShift,getScheduledShift,isHoliday,holidayName,shiftLabel,type ShiftValue} from '../../core.ts';
import {markdownToHtml,htmlToMarkdown,ensureEditorTables,addTableRow,addTableColumn,removeTable} from '../../markdown.ts';
import {Icon} from '../../Icon.tsx';
import {Button,download} from '../../app/AppShared.tsx';
export function ShiftEditor({state,date,setState,close,onNotice}:{state:State;date:string;setState:Dispatch<SetStateAction<State>>;close:()=>void;onNotice:(s:string)=>void}){
 const [shift,setShift]=useState<ShiftValue>(getShift(state,new Date(`${date}T12:00:00`)));
 const [note,setNote]=useState(state.shiftNotes[date]??'');
 const [tableMenu,setTableMenu]=useState<{id:string;x:number;y:number;mobile:boolean}|null>(null);
 const ref=useRef<HTMLDivElement>(null);
 const longPress=useRef<number|null>(null);
 const suppressContext=useRef(false);
 const scheduled=getScheduledShift(state,new Date(`${date}T12:00:00`));
 useEffect(()=>{if(ref.current){ref.current.innerHTML=markdownToHtml(note);ensureEditorTables(ref.current);window.setTimeout(()=>ref.current?.focus(),0)}},[date]);
 useEffect(()=>{const onKeyDown=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(tableMenu){setTableMenu(null);return}e.preventDefault();close()}};window.addEventListener('keydown',onKeyDown);return()=>window.removeEventListener('keydown',onKeyDown)},[close,tableMenu]);
 const syncNote=()=>{if(ref.current)setNote(htmlToMarkdown(ref.current))};
 const focusEditor=()=>{ref.current?.focus()};
 const exec=(command:string,value?:string)=>{focusEditor();document.execCommand(command,false,value);syncNote()};
 const insertLink=()=>{const url=window.prompt('URL ссылки','https://');if(!url)return;focusEditor();document.execCommand('createLink',false,url);syncNote()};
 const insertTable=()=>{focusEditor();const html='<div class="md-table-wrap"><table><thead><tr><th>Заголовок 1</th><th>Заголовок 2</th><th>Заголовок 3</th></tr></thead><tbody><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table></div><p><br></p>';document.execCommand('insertHTML',false,html);if(ref.current)ensureEditorTables(ref.current);syncNote()};
 const insertHeading=()=>exec('formatBlock','h2');
 const insertQuote=()=>exec('formatBlock','blockquote');
 const insertCode=()=>exec('formatBlock','pre');
 const tableAt=(target:EventTarget|null)=>target instanceof HTMLElement?target.closest('table') as HTMLTableElement|null:null;
 const tableId=(table:HTMLTableElement)=>{let id=table.dataset.wtTableId;if(!id){id=`wt-table-${Date.now()}-${Math.random().toString(36).slice(2)}`;table.dataset.wtTableId=id}return id};
 const openTableMenu=(table:HTMLTableElement,x:number,y:number,mobile:boolean)=>setTableMenu({id:tableId(table),x,y,mobile});
 const handleContextMenu=(e:React.MouseEvent<HTMLDivElement>)=>{const table=tableAt(e.target);if(!table)return;e.preventDefault();if(suppressContext.current){suppressContext.current=false;return}openTableMenu(table,e.clientX,e.clientY,false)};
 const handlePointerDown=(e:React.PointerEvent<HTMLDivElement>)=>{if(e.pointerType!=='touch')return;const table=tableAt(e.target);if(!table)return;longPress.current=window.setTimeout(()=>{suppressContext.current=true;window.setTimeout(()=>{suppressContext.current=false},1200);openTableMenu(table,window.innerWidth/2,window.innerHeight/2,true)},560)};
 const clearLongPress=()=>{if(longPress.current!==null){window.clearTimeout(longPress.current);longPress.current=null}};
 const handleKeyDown=(e:React.KeyboardEvent<HTMLDivElement>)=>{
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&e.key.toLowerCase()==='b'){e.preventDefault();exec('bold');return}
  if(mod&&e.key.toLowerCase()==='i'){e.preventDefault();exec('italic');return}
  if(mod&&e.key.toLowerCase()==='k'){e.preventDefault();insertLink();return}
  if(mod&&e.shiftKey&&e.key.toLowerCase()==='7'){e.preventDefault();exec('insertOrderedList');return}
  if(mod&&e.shiftKey&&e.key.toLowerCase()==='8'){e.preventDefault();exec('insertUnorderedList');return}
  if(mod&&e.shiftKey&&e.key.toLowerCase()==='x'){e.preventDefault();exec('formatBlock','pre');return}
 };
 const tableAction=(action:'row'|'column'|'delete')=>{if(!tableMenu||!ref.current)return;const table=Array.from(ref.current.querySelectorAll('table')).find(t=>(t as HTMLTableElement).dataset.wtTableId===tableMenu.id) as HTMLTableElement|undefined;if(!table){setTableMenu(null);return}if(action==='row')addTableRow(table);else if(action==='column')addTableColumn(table);else removeTable(table);setNote(htmlToMarkdown(ref.current));setTableMenu(null);window.requestAnimationFrame(()=>{if(action!=='delete')focusEditor()})};
 const save=()=>{setState(s=>{const overrides={...s.shiftOverrides};if(shift===scheduled)delete overrides[date];else overrides[date]=shift;const notes={...s.shiftNotes};if(note.trim())notes[date]=note;else delete notes[date];return {...s,shiftOverrides:overrides,shiftNotes:notes}});onNotice('Смена и заметка сохранены');close()};
 const exportOne=()=>{const body=note.trimEnd();if(!body){onNotice('В этой смене нет заметки');return}download(`workertink-${date}.md`,`# WTinker — заметка смены\n\n**Дата:** ${date}\n**Смена:** ${shiftLabel(shift)}\n\n${body}\n`);onNotice('Заметка экспортирована в MD')};
 const tools=[
  {label:'B',title:'Жирный · Ctrl/Cmd+B',action:()=>exec('bold'),content:<b>B</b>},
  {label:'I',title:'Курсив · Ctrl/Cmd+I',action:()=>exec('italic'),content:<i>I</i>},
  {label:'H2',title:'Заголовок',action:insertHeading,content:<b>H2</b>},
  {label:'•',title:'Маркированный список · Ctrl/Cmd+Shift+8',action:()=>exec('insertUnorderedList'),content:<b>•</b>},
  {label:'1.',title:'Нумерованный список · Ctrl/Cmd+Shift+7',action:()=>exec('insertOrderedList'),content:<b>1.</b>},
  {label:'Quote',title:'Цитата',action:insertQuote,content:<span>❝</span>},
  {label:'Code',title:'Код · Ctrl/Cmd+Shift+X',action:insertCode,content:<span>{'</>'}</span>},
  {label:'Link',title:'Ссылка · Ctrl/Cmd+K',action:insertLink,content:<Icon name="externalLink" size={14}/>},
  {label:'Table',title:'Вставить Markdown-таблицу',action:insertTable,content:<span>▦</span>},
 ];
 return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><section className="shift-modal" role="dialog" aria-modal="true" aria-labelledby="shift-editor-title">
  <header className="modal-head"><div><span className="eyebrow">Редактор смены</span><h2 id="shift-editor-title">{date}</h2><p>{isHoliday(new Date(`${date}T12:00:00`))?`Праздник · ${holidayName(new Date(`${date}T12:00:00`))}`:'Обычный день'}</p></div><button className="modal-close" onClick={close}>×</button></header>
  <div className="shift-editor-meta"><label className="field"><span className="field-label">Смена</span><select value={shift} onChange={e=>setShift(e.target.value as ShiftValue)}><option value="day">День</option><option value="night">Ночь</option>{state.scheduleType==='7/0'&&<option value="full">Сутки</option>}<option value="off">Выходной</option></select></label><div className="editor-source">По графику: <b>{shiftLabel(scheduled)}</b>{shift!==scheduled&&<span> · изменено вручную</span>}</div></div>
  <div className="markdown-workspace">
   <div className="markdown-toolbar" aria-label="Форматирование заметки">{tools.map(tool=><button key={tool.label} type="button" title={tool.title} aria-label={tool.title} onMouseDown={e=>e.preventDefault()} onClick={tool.action}>{tool.content}</button>)}</div>
   <div className="markdown-wysiwyg-wrap">
    <div className="editor-label"><b>Заметка</b><span>Форматирование отображается сразу</span></div>
    <div ref={ref} className="markdown-editor markdown-wysiwyg" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" data-placeholder="Напишите заметку по смене…" onInput={syncNote} onKeyDown={handleKeyDown} onContextMenu={handleContextMenu} onPointerDown={handlePointerDown} onPointerUp={clearLongPress} onPointerCancel={clearLongPress} onPointerMove={clearLongPress} />
    <div className="markdown-shortcuts">ПК: <kbd>Ctrl/Cmd</kbd> + <kbd>B</kbd> жирный · <kbd>I</kbd> курсив · <kbd>K</kbd> ссылка · <kbd>Shift+7/8</kbd> списки · ПКМ/зажатие по таблице — управление таблицей</div>
   </div>
  </div>
  {tableMenu&&<div className={`table-context ${tableMenu.mobile?'mobile':''}`} style={tableMenu.mobile?undefined:{left:Math.min(tableMenu.x,window.innerWidth-250),top:Math.min(tableMenu.y,window.innerHeight-170)}} role="dialog" aria-label="Действия с таблицей" onMouseDown={e=>e.stopPropagation()}><div className="table-context-head"><b>Таблица</b><button type="button" onClick={()=>setTableMenu(null)}>×</button></div><p>Изменить размер или удалить таблицу</p><div className="table-context-actions"><button type="button" onClick={()=>tableAction('row')}>＋ Строка</button><button type="button" onClick={()=>tableAction('column')}>＋ Столбец</button><button type="button" className="danger" onClick={()=>tableAction('delete')}>Удалить таблицу</button></div></div>}
  <footer className="modal-actions"><Button quiet onClick={exportOne} disabled={!note.trim()}>Экспорт MD</Button><Button quiet onClick={close}>Отмена</Button><Button primary onClick={save}>Сохранить</Button></footer>
 </section></div>
}

export default ShiftEditor;

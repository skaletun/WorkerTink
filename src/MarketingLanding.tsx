import {useState} from 'react';
import {Icon} from './Icon.tsx';

const base=()=>window.location.hostname.endsWith('github.io')?'/WorkerTink/':'/';
const link=(query:string)=>base()+'?'+query;
const features=[
 {number:'01',title:'Планируй смены',description:'Графики 5/2, 2/2, вахты и ручные изменения — в одном календаре.',icon:'calendar'},
 {number:'02',title:'Считай зарплату',description:'Оклад, доплаты, авансы, отпускные и больничные с понятной детализацией.',icon:'pay'},
 {number:'03',title:'Находи коллег',description:'Профессиональные профили, связи, сообщества и групповые рабочие пространства.',icon:'people'},
 {number:'04',title:'Общайся защищённо',description:'Личные сообщения и вложения с шифрованием на устройстве, групповые обсуждения.',icon:'chat'}
] as const;
const faqs=[
 ['WTinker — только календарь?','Нет. Это рабочее пространство: график, выплаты, заметки, коллеги, сообщества, личные и групповые чаты.'],
 ['Работает ли без интернета?','Календарь и локальные расчёты доступны офлайн после установки PWA. Друзья, переписка и синхронизация аккаунта требуют соединения.'],
 ['Где мои данные?','Рабочие записи и расчёты хранятся на устройстве. Настройки аккаунта, социальные данные, метаданные и зашифрованные сообщения обрабатываются через Directory API.'],
 ['Это замена расчётному листку?','Нет. WTinker помогает планировать и проверять приблизительные начисления по введённым данным. Официальные суммы необходимо сверять с работодателем.']
] as const;
export default function MarketingLanding(){
 const [openFaq,setOpenFaq]=useState<number|null>(0);
 return <div className="wt-landing">
  <header className="wt-landing-header"><a className="wt-landing-logo" href={base()} aria-label="WTinker — главная"><b>✳</b><span>wtinker.</span></a><nav aria-label="Навигация по странице"><a href="#possibilities">Возможности</a><a href="#how-it-works">Как работает</a><a href="#questions">Вопросы</a></nav><div className="wt-landing-header-actions"><a className="wt-landing-login" href={link('auth=login')}>Войти</a><a className="wt-landing-top-cta" href={link('auth=join')}>Начать <span>↗</span></a></div></header>
  <main>
   <section className="wt-landing-hero"><div className="wt-landing-intro"><span className="wt-landing-eyebrow"><i/> ЛЮДИ × РАБОТА × ВАШ РИТМ</span><h1>Работа.<br/><em>В одном ритме.</em></h1><p>Смены, деньги, коллеги и разговоры — наконец в одном месте. WTinker собирает твой рабочий день в понятную систему.</p><div className="wt-landing-actions"><a className="wt-landing-primary" href={link('auth=join')}>Создать аккаунт <span>↗</span></a><a className="wt-landing-secondary" href="#possibilities">Посмотреть возможности <Icon name="chevronRight" size={18}/></a></div><div className="wt-landing-proof"><span><Icon name="check" size={15}/> PWA на телефоне</span><span><Icon name="check" size={15}/> Рабочие расчёты офлайн</span></div></div>
    <div className="wt-landing-visual" aria-label="Иллюстрация интерфейса календаря, чата и финансов WTinker">
     <div className="wt-landing-visual-label">WORK / IN MOTION <span>01—04</span></div>
     <div className="wt-preview-display"><div className="wt-preview-top"><b>Понедельник, 14</b><span>ОКТ 2026</span></div><div className="wt-preview-headline">Ваш месяц.<br/><em>Ваши правила.</em></div><div className="wt-preview-calendar">{['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'].map(day=><span className="wt-preview-weekday" key={day}>{day}</span>)}{Array.from({length:35},(_,i)=><i key={i} className={i%7===5||i%7===6?'off':i%5===0?'night':i===13?'current':'day'}>{i<31?i+1:''}</i>)}</div><div className="wt-preview-foot"><span>● Смена</span><span>● Ночь</span><span>● Выходной</span></div></div>
     <div className="wt-preview-float wt-preview-float-chat"><span>СООБЩЕНИЯ</span><b>Команда на связи</b><p>Договорились. До завтра! 👋</p><small>Защищённый разговор</small></div>
     <div className="wt-preview-float wt-preview-float-pay"><span>ПРОГНОЗ ДОХОДА</span><b>87 450 ₽</b><small>Пример интерфейса, не ваш расчёт</small></div>
     <span className="wt-landing-visual-disclaimer">Иллюстрация продукта · демонстрационные данные</span>
    </div>
   </section>
   <div className="wt-landing-ticker" aria-label="Что объединяет WTinker"><span>РАБОЧИЙ ГРАФИК</span><i>✳</i><span>ЛЮДИ И КОМАНДЫ</span><i>✳</i><span>ЗАРПЛАТА</span><i>✳</i><span>ЗАЩИЩЁННЫЕ ЧАТЫ</span><i>✳</i><span>ВАШ КОНТРОЛЬ</span></div>
   <section id="possibilities" className="wt-landing-section"><div className="wt-landing-section-intro"><span>01 / ИНСТРУМЕНТЫ</span><h2>Не ещё одно приложение.<br/><em>Твоя рабочая среда.</em></h2><p>Нужное в течение смены — под рукой. Не переключайся между пятью отдельными сервисами.</p></div><div className="wt-landing-feature-grid">{features.map(f=><article key={f.number} className="wt-landing-feature"><div><span>{f.number} / WTINKER</span><Icon name={f.icon} size={24}/></div><h3>{f.title}</h3><p>{f.description}</p></article>)}</div></section>
   <section id="how-it-works" className="wt-landing-story"><div><span>02 / ТВОЯ СИСТЕМА</span><h2>Начни с графика.<br/><em>Продолжай вместе.</em></h2></div><ol><li><b>01</b><div><strong>Создай профиль</strong><p>Имя, должность и свой WTinkID — твоя точка входа.</p></div></li><li><b>02</b><div><strong>Настрой работу</strong><p>Выбери смены, оклад и отпуск. В любой момент можно изменить параметры.</p></div></li><li><b>03</b><div><strong>Подключай людей</strong><p>Находи коллег, переписывайся и собирай рабочее пространство.</p></div></li></ol></section>
   <section className="wt-landing-privacy"><div><span>03 / КОНТРОЛЬ ДАННЫХ</span><h2>Работа — твоя.<br/>Данные — тоже.</h2><p>Персональный календарь и расчёты сохраняются на устройстве. Аккаунт, социальные функции и синхронизация работают через сервер. Содержимое личных сообщений и вложений шифруется на устройстве.</p><a href={base()+'rules/privacy'}>Как мы работаем с данными <Icon name="chevronRight" size={17}/></a></div><div className="wt-landing-lock"><Icon name="shield" size={100}/><strong>ЛОКАЛЬНО + E2E</strong><small>Разные данные — разные уровни хранения и защиты</small></div></section>
   <section id="questions" className="wt-landing-faq"><div><span>04 / ВОПРОСЫ</span><h2>Без мелкого шрифта.</h2></div><div>{faqs.map(([question,answer],i)=><article key={question}><button type="button" aria-expanded={openFaq===i} onClick={()=>setOpenFaq(openFaq===i?null:i)}><b>{question}</b><span>{openFaq===i?'−':'+'}</span></button>{openFaq===i&&<p>{answer}</p>}</article>)}</div></section>
   <section className="wt-landing-closing"><span>НАЧНИ В СВОЁМ РИТМЕ</span><h2>Рабочая жизнь.<br/><em>Проще вместе.</em></h2><a href={link('auth=join')}>Попробовать WTinker <span>↗</span></a></section>
  </main>
  <footer className="wt-landing-footer"><div className="wt-landing-logo"><b>✳</b><span>wtinker.</span></div><p>Люди, работа, один ритм. © 2026 WTinker</p><nav><a href={base()+'rules/privacy'}>Конфиденциальность</a><a href={base()+'rules/terms'}>Условия</a><a href="mailto:support@workertink.app">Связаться</a></nav></footer>
 </div>;
}

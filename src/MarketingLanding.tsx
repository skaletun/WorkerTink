import {Icon} from './Icon.tsx';

const base=()=>window.location.hostname.endsWith('github.io')?'/WorkerTink/':'/';
const auth=(mode:'join'|'login')=>base()+'?auth='+mode;

const capabilities=[
 {id:'01',title:'График смен',text:'Рабочие дни, ночные смены, выходные и отпуска — в календаре с понятной структурой.',link:'Календарь и смены'},
 {id:'02',title:'Зарплата и начисления',text:'Считайте предполагаемую зарплату с учётом авансов, доплат, отпуска и больничных.',link:'Личные расчёты'},
 {id:'03',title:'Люди и сообщества',text:'Находите коллег по username или WTinkID, общайтесь и создавайте рабочие сообщества.',link:'Профессиональная сеть'},
 {id:'04',title:'Личные чаты',text:'Переписка, фотографии, файлы и голосовые сообщения с оконечным шифрованием.',link:'Защищённое общение'}
] as const;

const questions=[
 {q:'Нужно ли устанавливать WTinker?',a:'Нет. Приложение работает в браузере. Его также можно установить на главный экран телефона как PWA.'},
 {q:'Работают ли расчёты без интернета?',a:'Календарь и локальные расчёты доступны без подключения после первоначальной загрузки приложения. Переписка, поиск людей и синхронизация аккаунта требуют интернета.'},
 {q:'Какие данные доступны серверу?',a:'Рабочие записи и личные расчёты хранятся в браузере. Данные аккаунта и социальные функции используют сервер. Личные сообщения и вложения шифруются на устройстве. Закрытые ключи для их расшифровки остаются в локальном хранилище.'},
 {q:'Можно ли использовать расчёт зарплаты как расчётный лист?',a:'Нет. Это личный инструмент для оценки начислений по введённым параметрам, а не официальный документ работодателя.'}
] as const;

const week=[
 {day:'Пн',date:'12',kind:'work',label:'День'},
 {day:'Вт',date:'13',kind:'work',label:'День'},
 {day:'Ср',date:'14',kind:'off',label:'Выходной'},
 {day:'Чт',date:'15',kind:'off',label:'Выходной'},
 {day:'Пт',date:'16',kind:'work',label:'День'},
 {day:'Сб',date:'17',kind:'work',label:'День'},
 {day:'Вс',date:'18',kind:'off',label:'Выходной'}
] as const;

function Wordmark(){
 return <a className="wl-wordmark" href={base()} aria-label="WTinker — на главную">
  <img src={base()+'icon-256.png'} alt="" width="37" height="37"/>
  <span>WTinker</span>
 </a>;
}

function ProductPreview(){
 return <div className="wl-product" aria-label="Демонстрация интерфейса календаря и заметок WTinker">
  <div className="wl-product-top">
   <div className="wl-product-app"><img src={base()+'icon-256.png'} alt="" width="22" height="22"/><span>WTinker</span></div>
   <span className="wl-product-status">Рабочее пространство</span>
  </div>
  <div className="wl-product-body">
   <aside className="wl-product-side" aria-label="Разделы приложения">
    <div className="is-current"><Icon name="calendar" size={17}/><span>Календарь</span></div>
    <div><Icon name="pay" size={17}/><span>Зарплата</span></div>
    <div><Icon name="people" size={17}/><span>Люди</span></div>
    <div><Icon name="chat" size={17}/><span>Чаты</span></div>
   </aside>
   <div className="wl-product-content">
    <div className="wl-product-heading">
     <div><span className="wl-preview-label">Личный график</span><h3>Октябрь 2026</h3></div>
     <span className="wl-schedule-type">График 2/2</span>
    </div>
    <div className="wl-calendar-grid">
     {week.map(item=><div className={'wl-calendar-day '+(item.kind==='work'?'is-work':'is-off')} key={item.date}>
      <span>{item.day}</span>
      <strong>{item.date}</strong>
      <small>{item.label}</small>
     </div>)}
    </div>
    <div className="wl-product-bottom">
     <div className="wl-preview-note">
      <span className="wl-preview-label">Записи на смену</span>
      <strong>Всё важное под рукой</strong>
      <p>Заметки привязаны к дате в календаре.</p>
     </div>
     <div className="wl-preview-pay">
      <Icon name="pay" size={19}/>
      <div><strong>Мой расчёт</strong><span>Оклад, доплаты, аванс</span></div>
     </div>
    </div>
   </div>
  </div>
 </div>;
}

export default function MarketingLanding(){
 return <div className="wt-landing">
  <a href="#main-content" className="wl-skip">Перейти к содержимому</a>
  <header className="wl-header">
   <div className="wl-container wl-header-content">
    <Wordmark/>
    <nav aria-label="Навигация по лендингу">
     <a href="#features">Возможности</a>
     <a href="#product">Приложение</a>
     <a href="#security">Безопасность</a>
    </nav>
    <div className="wl-header-actions">
     <a href={auth('login')} className="wl-login">Войти</a>
     <a href={auth('join')} className="wl-button wl-button-small">Регистрация <Icon name="chevronRight" size={17}/></a>
    </div>
   </div>
  </header>

  <main id="main-content">
   <section className="wl-hero">
    <div className="wl-container wl-hero-grid">
     <div className="wl-hero-copy">
      <p className="wl-kicker">Рабочее пространство</p>
      <h1>Рабочие дела.<br/><span>Без лишнего.</span></h1>
      <p className="wl-hero-description">График смен, расчёт зарплаты, заметки и общение с коллегами. Всё, что нужно для рабочего дня, в одном приложении.</p>
      <div className="wl-hero-actions">
       <a href={auth('join')} className="wl-button wl-button-primary">Создать аккаунт <Icon name="chevronRight" size={19}/></a>
       <a href="#product" className="wl-inline-link">Посмотреть интерфейс <Icon name="chevronRight" size={17}/></a>
      </div>
      <p className="wl-hero-footnote">В браузере и на телефоне · основные личные расчёты работают офлайн</p>
     </div>
     <div className="wl-hero-art">
      <div className="wl-preview-surround">
       <span className="wl-preview-overline">Обзор приложения</span>
       <ProductPreview/>
       <span className="wl-preview-caption">Демонстрационные данные. Не отражают реальный график пользователя.</span>
      </div>
     </div>
    </div>
   </section>

   <section className="wl-section wl-features" id="features">
    <div className="wl-container">
     <div className="wl-section-heading">
      <p className="wl-kicker">Возможности</p>
      <h2>Один сервис для ежедневных задач.</h2>
      <p>Без переключения между календарём, калькулятором и мессенджером.</p>
     </div>
     <div className="wl-feature-list">
      {capabilities.map(item=><article key={item.id} className="wl-feature">
       <span className="wl-feature-number">{item.id}</span>
       <div><h3>{item.title}</h3><p>{item.text}</p></div>
       <span className="wl-feature-type">{item.link}</span>
      </article>)}
     </div>
    </div>
   </section>

   <section className="wl-section wl-workflow" id="product">
    <div className="wl-container wl-workflow-grid">
     <div className="wl-workflow-intro">
      <p className="wl-kicker">Как это работает</p>
      <h2>От своей смены до общего дела.</h2>
      <p>Начните с личного графика. Остальные инструменты доступны по мере необходимости.</p>
      <a href={auth('join')} className="wl-inline-link">Перейти к регистрации <Icon name="chevronRight" size={18}/></a>
     </div>
     <ol className="wl-steps">
      <li><span>01</span><div><h3>Создайте профиль</h3><p>Укажите имя и username, чтобы коллеги могли вас найти.</p></div></li>
      <li><span>02</span><div><h3>Настройте график и расчёты</h3><p>Выберите режим смен и параметры оплаты. При необходимости скорректируйте вручную.</p></div></li>
      <li><span>03</span><div><h3>Общайтесь и работайте вместе</h3><p>Добавляйте коллег, создавайте сообщества и обменивайтесь сообщениями.</p></div></li>
     </ol>
    </div>
   </section>

   <section className="wl-section wl-security" id="security">
    <div className="wl-container wl-security-grid">
     <div>
      <p className="wl-kicker">Безопасность и данные</p>
      <h2>Переписка остаётся личной.</h2>
      <p>Содержимое личных сообщений и вложений шифруется на вашем устройстве. Рабочие записи и расчёты сохраняются локально; учётная запись и социальные функции используют сервер.</p>
      <a href={base()+'rules/privacy'} className="wl-inline-link">Политика конфиденциальности <Icon name="chevronRight" size={17}/></a>
     </div>
     <div className="wl-security-points">
      <div><Icon name="lock" size={21}/><span><strong>Оконечное шифрование</strong><small>Личные сообщения и файлы</small></span></div>
      <div><Icon name="calendar" size={21}/><span><strong>Локальные записи</strong><small>График, заметки и расчёты</small></span></div>
      <div><Icon name="shield" size={21}/><span><strong>Контроль ключей</strong><small>E2E-ключи сохраняются на устройстве. При их утрате восстановление переписки может быть невозможно.</small></span></div>
     </div>
    </div>
   </section>

   <section className="wl-section wl-questions" id="questions">
    <div className="wl-container wl-questions-grid">
     <div><p className="wl-kicker">Частые вопросы</p><h2>Что важно знать</h2></div>
     <div className="wl-faq-list">{questions.map(item=><details key={item.q}>
      <summary>{item.q}<Icon name="chevronDown" size={19}/></summary>
      <p>{item.a}</p>
     </details>)}</div>
    </div>
   </section>

   <section className="wl-final">
    <div className="wl-container wl-final-content">
     <div><p className="wl-kicker">WTinker</p><h2>Для работы и тех,<br/>с кем вы работаете.</h2></div>
     <a className="wl-button wl-button-light" href={auth('join')}>Начать работу <Icon name="chevronRight" size={19}/></a>
    </div>
   </section>
  </main>

  <footer className="wl-footer"><div className="wl-container wl-footer-content">
   <div><Wordmark/><small>© 2026 WTinker</small></div>
   <nav aria-label="Юридическая информация и контакты">
    <a href={base()+'rules/privacy'}>Конфиденциальность</a>
    <a href={base()+'rules/terms'}>Условия использования</a>
    <a href="mailto:support@workertink.app">Контакты</a>
   </nav>
  </div></footer>
 </div>;
}

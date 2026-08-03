
// Simple expense tracker with localStorage
const form = document.getElementById('expense-form');
const titleIn = document.getElementById('title');
const amountIn = document.getElementById('amount');
const categoryIn = document.getElementById('category');
const typeIn = document.getElementById('type');
const filterCategory = document.getElementById('filter-category');
const dateIn = document.getElementById('date');
const expensesList = document.getElementById('expenses');
const totalEl = document.getElementById('total');
const incomeEl = document.getElementById('income');
const expenseEl = document.getElementById('expense');
const filterMonth = document.getElementById('filter-month');
const currencySel = document.getElementById('currency');
const installBtn = document.getElementById('installBtn');
const clearBtn = document.getElementById('clear');

let expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
let editingId = null;

function save(){
	localStorage.setItem('expenses', JSON.stringify(expenses));
}

function formatCurrency(v){
	const code = currencySel ? currencySel.value : 'INR';
	// choose locale for INR, otherwise use default
	const locale = code === 'INR' ? 'en-IN' : navigator.language || 'en-US';
	try{
		return new Intl.NumberFormat(locale, { style:'currency', currency: code }).format(v);
	}catch(e){
		// fallback
		return (v<0?'-':'') + code + ' ' + Math.abs(v).toFixed(2);
	}
}

function render(){
	expensesList.innerHTML = '';
	let total = 0, income = 0, exp = 0;
	const selected = filterMonth.value;
	const selectedCat = filterCategory.value;
	const months = new Set();
	const categories = new Set();

	expenses.slice().reverse().forEach((it, idx)=>{
		const d = it.date ? new Date(it.date) : null;
		const key = d ? d.getFullYear()+'-'+(d.getMonth()+1) : 'no-date';
		months.add(key);
		if(it.category) categories.add(it.category);
		if(selected !== 'all' && selected !== key) return;
		if(selectedCat !== 'all' && it.category !== selectedCat) return;

		const li = document.createElement('li');
		const meta = document.createElement('div'); meta.className = 'meta';
		const h = document.createElement('div'); h.textContent = it.title;
		const cat = document.createElement('div'); cat.className = 'category';
		cat.textContent = [it.category, it.date].filter(Boolean).join(' • ');
		meta.appendChild(h); meta.appendChild(cat);

		const amount = document.createElement('div'); amount.className = 'amount';
		const val = parseFloat(it.amount)||0;
		amount.textContent = formatCurrency(val);
		amount.classList.add(val<0? 'negative' : 'positive');

		const actions = document.createElement('div');
		const editBtn = document.createElement('button'); editBtn.textContent = 'Edit'; editBtn.className='btn';
		editBtn.onclick = ()=>{
			// populate form for editing
			titleIn.value = it.title;
			amountIn.value = Math.abs(it.amount);
			categoryIn.value = it.category || '';
			dateIn.value = it.date || '';
			typeIn.value = it.amount < 0 ? 'expense' : 'income';
			editingId = it.id;
			document.querySelector('.btn.primary').textContent = 'Save';
		};
		const del = document.createElement('button'); del.textContent = 'Delete'; del.className='btn';
		del.onclick = ()=>{ expenses = expenses.filter(e=> e.id !== it.id); save(); render(); };
		actions.appendChild(editBtn);
		actions.appendChild(del);

		li.appendChild(meta);
		li.appendChild(amount);
		li.appendChild(actions);
		expensesList.appendChild(li);

		total += val; if(val<0) exp += val; else income += val;
	});

	totalEl.textContent = formatCurrency(total);
	incomeEl.textContent = formatCurrency(income);
	expenseEl.textContent = formatCurrency(Math.abs(exp));

	// populate months
	const monthsArr = Array.from(months).sort().reverse();
	filterMonth.innerHTML = '<option value="all">All</option>' + monthsArr.map(m=>`<option value="${m}">${m}</option>`).join('');
	if(!monthsArr.includes(filterMonth.value) && filterMonth.value !== 'all') filterMonth.value = 'all';

	// populate categories
	const cats = Array.from(categories).sort();
	filterCategory.innerHTML = '<option value="all">All Categories</option>' + cats.map(c=>`<option value="${c}">${c}</option>`).join('');
	if(!cats.includes(filterCategory.value) && filterCategory.value !== 'all') filterCategory.value = 'all';
}

form.addEventListener('submit', e=>{
	e.preventDefault();
	const t = titleIn.value.trim();
	let a = parseFloat(amountIn.value) || 0;
	const typ = typeIn.value;
	if(!t || !a){ return; }
	// normalize sign based on type
	a = typ === 'expense' ? -Math.abs(a) : Math.abs(a);
	const payload = { id: editingId || Date.now().toString(), title: t, amount: a, category: categoryIn.value.trim(), date: dateIn.value };
	if(editingId){
		expenses = expenses.map(e=> e.id === editingId ? payload : e);
		editingId = null;
		document.querySelector('.btn.primary').textContent = 'Add';
	} else {
		expenses.push(payload);
	}
	save(); render();
	form.reset();
});

filterMonth.addEventListener('change', render);
filterCategory.addEventListener('change', render);
currencySel && currencySel.addEventListener('change', render);
// show install button by default; if browser fires beforeinstallprompt we'll still use it
installBtn && (installBtn.style.display = 'inline-block');

// PWA install handling
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
	e.preventDefault();
	deferredPrompt = e;
	if(installBtn) installBtn.style.display = 'inline-block';
});

installBtn && installBtn.addEventListener('click', async ()=>{
	if(deferredPrompt){
		deferredPrompt.prompt();
		const choice = await deferredPrompt.userChoice;
		deferredPrompt = null;
		installBtn.style.display = 'none';
	} else {
		// fallback: instruct user how to install via browser UI
		showToast('Install not available programmatically. Use your browser menu: "Install app" or "Add to Home screen".', 6000);
	}
});

// Service worker registration for offline support
if('serviceWorker' in navigator){
	window.addEventListener('load', ()=>{
		navigator.serviceWorker.register('service-worker.js').then(reg=>{
			// detect updates
			if(reg.waiting){
				showUpdateToast();
			}
			reg.addEventListener('updatefound', ()=>{
				const newSW = reg.installing;
				newSW && newSW.addEventListener('statechange', ()=>{
					if(newSW.state === 'installed' && navigator.serviceWorker.controller){
						showUpdateToast();
					}
				});
			});
		}).catch(()=>{});
	});
}

window.addEventListener('appinstalled', ()=>{
	showToast('App installed');
});

function showToast(msg, timeout=3000){
	let el = document.getElementById('gt-toast');
	if(!el){
		el = document.createElement('div'); el.id='gt-toast';
		el.style.position='fixed'; el.style.left='50%'; el.style.bottom='24px'; el.style.transform='translateX(-50%)';
		el.style.background='rgba(0,0,0,0.7)'; el.style.color='white'; el.style.padding='10px 14px'; el.style.borderRadius='8px'; el.style.zIndex=9999;
		document.body.appendChild(el);
	}
	el.textContent = msg; el.style.display='block';
	setTimeout(()=> el.style.display='none', timeout);
}

function showUpdateToast(){
	const container = document.createElement('div');
	container.style.position='fixed'; container.style.left='50%'; container.style.bottom='80px'; container.style.transform='translateX(-50%)';
	container.style.zIndex=10000;
	const box = document.createElement('div');
	box.style.background='linear-gradient(90deg,#60A5FA,#6EE7B7)'; box.style.color='#04273b'; box.style.padding='10px 14px'; box.style.borderRadius='8px';
	box.textContent='New version available';
	const btn = document.createElement('button'); btn.textContent='Reload'; btn.className='btn'; btn.style.marginLeft='10px';
	btn.onclick = ()=> location.reload();
	box.appendChild(btn); container.appendChild(box); document.body.appendChild(container);
	setTimeout(()=> container.remove(), 8000);
}
clearBtn.addEventListener('click', ()=>{ if(confirm('Clear all expenses?')){ expenses = []; save(); render(); } });

render();

const initScroller = () => {
	const pagenav = document.querySelectorAll('.pagenav a');
	const headers = Array.from(pagenav).map(link => document.querySelector(`#${link.href.split('#')[1]}`));
	if (!pagenav.length) {
		document.querySelectorAll(".nav-label")[1].classList.add("hidden");
	}

	const addClassToFirstLink = () => pagenav[0].classList.add('text-active');
	const addTransitionClasses = () => pagenav.forEach(link => link.classList.add('transition', 'duration-200'));

	addClassToFirstLink();
	addTransitionClasses();

	const onScroll = () => {
		if (!ticking) {
			requestAnimationFrame(update);
			ticking = true;
		}
	};


	const update = () => {
		const activeHeader = headers.find(header => header.getBoundingClientRect().top > 160) || headers[0];
		const activeIndex = headers.indexOf(activeHeader);

		if (activeHeader !== currentActiveHeader) {
			currentActiveHeader = activeHeader;
			pagenav.forEach(link => link.classList.remove('text-active'));
			pagenav[activeIndex].classList.add('text-active');
		}
		ticking = false;
	};

	let ticking = false;
	let currentActiveHeader = headers[0];

	document.querySelector('.grid').addEventListener('scroll', onScroll);
};

document.addEventListener('DOMContentLoaded', initScroller);

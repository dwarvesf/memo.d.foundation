class Scroller {
	static init() {
		if (document.querySelector('.pagenav')) {
			let i = 0;
			this.pagenav = document.querySelectorAll('.pagenav a');
			this.pagenav.forEach(link => {
				if (i === 0) {
					link.classList.add('text-active');
					i++;
				}
				link.classList.add('transition', 'duration-200');
			});
			this.headers = Array.from(this.pagenav).map(link => {
				return document.querySelector(`#${link.href.split('#')[1]}`);
			});
			this.ticking = false;
			window.addEventListener('scroll', (e) => {
				this.onScroll()
			});
		}
	}

	static onScroll() {
		if (!this.ticking) {
			requestAnimationFrame(this.update.bind(this));
			this.ticking = true;
		}
	}

	static update() {
		this.activeHeader ||= this.headers[0];
		let activeIndex = this.headers.findIndex((header) => {
			return header.getBoundingClientRect().top > 160;
		});
		if (activeIndex == -1) {
			activeIndex = this.headers.length - 1;
		} else if (activeIndex > 0) {
			activeIndex--;
		}
		let active = this.headers[activeIndex];
		if (active !== this.activeHeader) {
			this.activeHeader = active;
			this.pagenav.forEach(link => link.classList.remove('text-active'));
			this.pagenav[activeIndex].classList.add('text-active');
		}
		this.ticking = false;
	}
}

document.addEventListener('DOMContentLoaded', function (e) {
	Scroller.init();
})
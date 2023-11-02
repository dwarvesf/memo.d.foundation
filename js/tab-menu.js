Array.from(document.getElementsByClassName('tab-menu') || []).forEach(element => {
    const activeLi = element.querySelector("li.active");

    if (activeLi) {
        const elementLeft = element.scrollLeft;
        const elementRight = elementLeft + element.clientWidth;
      
        const activeLiLeft = activeLi.offsetLeft;
        const activeLiRight = activeLiLeft + activeLi.clientWidth;

        let scrollOffset = 0;
      
        if (activeLiLeft < elementLeft) {
            scrollOffset = activeLiLeft;
        } else if (activeLiRight > elementRight) {
            scrollOffset = activeLiRight - element.clientWidth;
        }

        // scroll the nav menu until the active tab appears
        for(let i=0; i<scrollOffset; i++){
            setTimeout(()=>{
                element.scrollLeft = i;
            }, i)
        }
      }
})
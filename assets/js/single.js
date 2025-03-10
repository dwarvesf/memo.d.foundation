// Subscription form
function loadSubscriptionForm() {
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function setSubmitting(isSubmitting) {
    const form = document.getElementById('subscriptionForm');
    const button = document.getElementById('submitButton');
    const input = document.getElementById('emailInput');

    button.disabled = isSubmitting;
    input.disabled = isSubmitting;
    button.classList.toggle('loading', isSubmitting);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const emailInput = document.getElementById('emailInput');
    const email = emailInput.value.trim();

    if (!isValidEmail(email)) {
      window.alert('Please enter a valid email address');
      emailInput.focus();
      return;
    }

    setSubmitting(true);

    try {
      // Simulate API call with a delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Successful submission
      Toastify({
        text: 'Thank you for subscribing!',
        duration: 3000,
        newWindow: true,
        close: false,
        gravity: 'top',
        position: 'center',
        stopOnFocus: true,
      }).showToast();
      emailInput.value = '';
    } catch (error) {
      window.alert('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  document
    .querySelector('#subscriptionForm')
    .addEventListener('submit', handleSubmit);
}


// Load more mentioned in
function handleLoadMoreMentionedIn() {
  const button = document.querySelector('button.mentionedin_btn');
  const ul = document.querySelector('.mentionin ul');
  const data = JSON.parse(ul.getAttribute('data-x'));

  button.addEventListener('click', () => {
    if (data.length > 0) {
      const fragment = document.createDocumentFragment();
      data.forEach((item) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = item.url;
        a.textContent = item.title;
        li.appendChild(a);
        fragment.appendChild(li);
      });
      ul.appendChild(fragment);
      button.parentElement.removeChild(button);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadSubscriptionForm();
});
window.addEventListener('load', handleLoadMoreMentionedIn);

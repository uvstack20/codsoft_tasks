const yearSpans = document.querySelectorAll('.year');
yearSpans.forEach((span) => {
  span.textContent = new Date().getFullYear();
});

const contactForm = document.getElementById('contactForm');
const formMessage = document.getElementById('formMessage');

if (contactForm && formMessage) {
  const fields = contactForm.querySelectorAll('input, textarea');

  fields.forEach((field) => {
    field.addEventListener('input', () => {
      if (field.checkValidity()) {
        field.style.borderColor = '#2dd4bf';
      } else {
        field.style.borderColor = '#ff6b6b';
      }
    });
  });

  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();

    let isValid = true;

    fields.forEach((field) => {
      if (!field.checkValidity()) {
        isValid = false;
        field.style.borderColor = '#ff6b6b';
      } else {
        field.style.borderColor = '#2dd4bf';
      }
    });

    if (!isValid) {
      formMessage.textContent = 'Please fill in all fields correctly before submitting.';
      formMessage.style.color = '#ff6b6b';
      return;
    }

    formMessage.textContent = 'Thanks! Your message has been captured. I will be in touch soon.';
    formMessage.style.color = '#2dd4bf';
    contactForm.reset();
  });
}

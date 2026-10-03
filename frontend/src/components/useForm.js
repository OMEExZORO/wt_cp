import { useState } from 'react';

export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setValues((v) => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
    setErrors((er) => (er[name] ? { ...er, [name]: undefined } : er));
  };

  const submit = async (fn) => {
    setSubmitting(true);
    setErrors({});
    setMessage({ type: '', text: '' });
    try {
      return await fn(values);
    } catch (err) {
      setErrors(err.errors || {});
      setMessage({ type: 'error', text: err.message });
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  return { values, setValues, errors, setErrors, message, setMessage, submitting, onChange, submit };
}

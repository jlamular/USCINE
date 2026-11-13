function ErrorList({ errors }) {
  if (!errors || errors.length === 0) {
    return null;
  }

  return (
    <ul className="error-list">
      {errors.map((message, index) => (
        <li key={`${index}-${message}`}>{message}</li>
      ))}
    </ul>
  );
}

export default ErrorList;
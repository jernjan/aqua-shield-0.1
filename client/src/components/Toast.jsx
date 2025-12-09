function Toast({ message, type = 'success' }) {
  return (
    <div className={`toast ${type}`}>
      {message}
    </div>
  )
}

export default Toast

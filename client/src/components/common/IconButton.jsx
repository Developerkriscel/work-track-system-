export function IconButton({ icon: Icon, label, tone = 'neutral', onClick }) {
  return (
    <button type="button" className={`icon-button icon-button--${tone}`} aria-label={label} title={label} onClick={onClick}>
      <Icon className="icon-button__icon" />
    </button>
  );
}

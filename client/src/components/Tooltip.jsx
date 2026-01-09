import React, { useState } from 'react';
import styles from './Tooltip.module.css';

export default function Tooltip({ text, children, position = 'top' }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.tooltipContainer}>
      <div
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className={styles.trigger}
      >
        {children}
      </div>
      {visible && (
        <div className={`${styles.tooltip} ${styles[position]}`}>
          {text}
        </div>
      )}
    </div>
  );
}

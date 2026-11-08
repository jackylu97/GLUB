<script lang="ts">
  let {
    label,
    detail = '',
    disabled = false,
    onclick,
  }: { label: string; detail?: string; disabled?: boolean; onclick: (e: MouseEvent) => void } = $props();
</script>

<button class="coupon" type="button" {disabled} {onclick}>
  <span class="label">{label}</span>
  {#if detail}<span class="detail cond">{detail}</span>{/if}
</button>

<style>
  .coupon {
    width: 100%;
    min-height: 104px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
    padding: 14px 18px;
    text-align: left;
    background: var(--cel);
    border: 4px dashed var(--ink);
    border-radius: 6px;
    cursor: pointer;
    transform: rotate(1deg);
  }

  .coupon:not(:disabled) {
    animation: armed 2.4s ease-in-out infinite;
  }

  .coupon:hover:not(:disabled) {
    animation: jelly 0.55s ease-in-out infinite;
    background: var(--coral);
  }

  .coupon:active:not(:disabled) {
    animation: none;
    transform: scale(0.94, 0.86);
  }

  @keyframes armed {
    0%, 100% { transform: rotate(1deg); }
    50% { transform: rotate(-1.5deg) scale(1.02); }
  }

  .coupon:disabled {
    cursor: not-allowed;
    background: transparent;
  }

  .label {
    font-family: var(--font-display);
    font-size: clamp(28px, 3vw, 37px);
    line-height: 1;
    color: var(--coral-text);
    text-wrap: balance;
  }

  .coupon:hover:not(:disabled) .label {
    color: var(--ink);
  }

  .coupon:disabled .label {
    color: var(--muted);
  }

  .detail {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  @media (max-width: 959px) {
    .coupon {
      min-height: 68px;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: 8px 14px;
    }

    .label {
      font-size: 28px;
    }

    .detail {
      font-size: 14px;
      text-align: right;
    }
  }
</style>

<script lang="ts">
  export let text: string;
</script>

<span class="group/tooltip relative inline-block">
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    class="w-4 h-4 cursor-help"
  >
    <path
      fill-rule="evenodd"
      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z"
      clip-rule="evenodd"
    />
  </svg>
  <span
    class="invisible group-hover/tooltip:visible absolute left-1/2 -translate-x-1/2 -top-2 transform -translate-y-full w-72 px-2 py-1 bg-gray-700 dark:bg-gray-600 text-white text-center text-sm rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition pointer-events-none"
  >
    {text}
  </span>
</span>

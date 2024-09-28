const formatTime = (time: number) => {
  const hours = Math.floor(time / (60 * 60 * 1000));
  const minutes = Math.floor((time % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((time % (60 * 1000)) / 1000);
  return `${hours}h ${minutes}m ${seconds}s`;
};

let startDate: Date | null;

export function setUptime() {
  if (!startDate) {
    startDate = new Date();
  }
}

export function getUptime() {
  const time = startDate ? new Date().getTime() - startDate.getTime() : 0;
  return formatTime(time);
}

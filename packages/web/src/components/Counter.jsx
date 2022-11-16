
import { useEffect, useRef, useState } from "react";


const Counter = ({ seconds, callback, stopTimer }) => {
  const [timeLeft, setTimeLeft] = useState(+seconds);
  const intervalRef = useRef();

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);
    return () => {
      console.log("aklsdlaks;dlk close")
      clearInterval(intervalRef.current);
    }
  }, []);

  // useEffect(() => {
  //   console.log("stopTimer changed", stopTimer)
  // }, [stopTimer])

  useEffect(() => {
    if (timeLeft <= 0) {
      clearInterval(intervalRef.current);
      if (callback) callback()

    }
  }, [timeLeft]);
  return (
    <>
      <div>{timeLeft}s</div>
    </>
  );
}

export default Counter;

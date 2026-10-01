async function run() {
  const payload = {
    employeeId: 'GA122',
    startDate: '2026-08-01',
    endDate: '2026-08-31'
  };

  try {
    const res = await fetch('http://localhost:5000/api/attendance/team/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
       console.log("Error status:", res.status);
       console.log(await res.text());
       return;
    }
    const data = await res.json();
    console.log("Calendar API response length:", data.data?.length);
    
    // find a day that should have punches, like Aug 14th for GA122
    const aug14 = data.data?.find(d => d.date === '2026-08-14');
    console.log("Aug 14 data:", JSON.stringify(aug14, null, 2));

  } catch (err) {
    console.log("Error calling API:", err);
  }
}

run();

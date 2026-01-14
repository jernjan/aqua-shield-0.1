#!/usr/bin/env node
// Direct backtesting test - no async nonsense
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/backtest/start',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
};

const payload = JSON.stringify({
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    step: '7days'
});

console.log('🧪 AquaShield Backtesting Test');
console.log('');
console.log('📤 POST http://localhost:3001/api/admin/backtest/start');
console.log('📦 Payload:', payload);
console.log('');

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(`✅ Status: ${res.statusCode}`);
        console.log('📥 Response:', data);
        
        try {
            const response = JSON.parse(data);
            const jobId = response.jobId;
            console.log('');
            console.log(`🎯 Job ID: ${jobId}`);
            console.log(`📊 Message: ${response.message}`);
            console.log(`🔗 Status URL: http://localhost:3001${response.statusUrl}`);
            
            // Now poll status
            setTimeout(() => pollStatus(jobId), 2000);
        } catch (e) {
            console.log('❌ Failed to parse response:', e.message);
        }
    });
});

req.on('error', (err) => {
    console.error('❌ Request error:', err.message);
    process.exit(1);
});

req.write(payload);
req.end();

// Poll job status
function pollStatus(jobId) {
    const statusOptions = {
        hostname: 'localhost',
        port: 3001,
        path: `/api/admin/backtest/status/${jobId}`,
        method: 'GET'
    };

    console.log('');
    console.log('⏳ Polling job status...');
    let pollCount = 0;
    const maxPolls = 120; // 10 minutes with 5-second intervals

    const poll = () => {
        pollCount++;
        if (pollCount > maxPolls) {
            console.log('❌ Timeout (10 minutes)');
            process.exit(1);
        }

        const req = http.request(statusOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const status = JSON.parse(data);
                    process.stdout.write(`\r  [${pollCount}] Progress: ${status.progress}% - ${status.currentDate}`);

                    if (status.status === 'completed') {
                        console.log('\n✅ Backtesting completed!');
                        getResults(jobId);
                    } else if (status.status === 'failed') {
                        console.log('\n❌ Backtesting failed');
                        process.exit(1);
                    } else {
                        setTimeout(poll, 5000);
                    }
                } catch (e) {
                    console.log('\n⚠️ Parse error:', e.message);
                    setTimeout(poll, 5000);
                }
            });
        });

        req.on('error', (err) => {
            console.log('\n⚠️ Status check error:', err.message);
            setTimeout(poll, 5000);
        });

        req.end();
    };

    poll();
}

// Get final results
function getResults(jobId) {
    const resultOptions = {
        hostname: 'localhost',
        port: 3001,
        path: `/api/admin/backtest/results/${jobId}`,
        method: 'GET'
    };

    const req = http.request(resultOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const results = JSON.parse(data);
                console.log('');
                console.log('📊 BACKTESTING RESULTS');
                console.log('='.repeat(50));
                console.log(`Period: ${results.period}`);
                console.log(`Duration: ${results.duration}ms`);
                console.log('');
                console.log('📈 METRICS:');
                console.log(`  Sensitivity (TPR): ${results.metrics.sensitivity}`);
                console.log(`  Specificity (TNR): ${results.metrics.specificity}`);
                console.log(`  Precision (PPV):   ${results.metrics.precision}`);
                console.log(`  F1 Score:          ${results.metrics.f1}`);
                console.log('');
                console.log('🎯 CONFUSION MATRIX:');
                console.log(`  True Positives:   ${results.metrics.truePositives}`);
                console.log(`  False Positives:  ${results.metrics.falsePositives}`);
                console.log(`  True Negatives:   ${results.metrics.trueNegatives}`);
                console.log(`  False Negatives:  ${results.metrics.falseNegatives}`);
                console.log(`  Total Predictions: ${results.metrics.totalPredictions}`);
                console.log('');
                console.log('✅ Backtesting test complete!');
                process.exit(0);
            } catch (e) {
                console.log('❌ Results parse error:', e.message);
                process.exit(1);
            }
        });
    });

    req.on('error', (err) => {
        console.log('❌ Results request error:', err.message);
        process.exit(1);
    });

    req.end();
}

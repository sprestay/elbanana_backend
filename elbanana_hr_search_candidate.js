const ConvertJobTypesToString = () => {
    var permanent = "yes";
    var contract = "yes";
    var internship = "no";
    var parttime = "no";
    var list = [];
    if (permanent == "yes")
        list.push("Permanent");
    if (contract == "yes")
        list.push("Contract");
    if (internship == "yes");
        list.push("Internship");
    if (parttime == "yes")
        list.push("Part-time");
    
    return list.join(', ');
}

const ConvertPlacementToString = () => {
    var address = "";
    var remote_open_timezone = "GMT+3";
    if (remote_open_timezone.length && address.length)
        var place = "Remote possible";
    else if (remote_open_timezone.length)
        var place = "Remote";
    else
        var place = "On-site";

    var permanent = "yes";
    var contract = "yes";
    var internship = "no";
    var parttime = "no";
    var list = [place];
    var remote_hours = "10"; // JobTypeParttimeHours
    if (permanent == "yes")
        list.push("Permanent");
    if (contract == "yes")
        list.push("Contract");
    if (internship == "yes");
        list.push("Internship");
    if (parttime == "yes")
        list.push(`Part-time ${remote_hours}h/m`);
        
    return list.join(', ');
}

const ConvertCanStartFunction = () => {
    var main_ready_start = "Immediately";
    switch (main_ready_start) {
        case "Immediately": 
            return "Immediately";
        case "Notice period":
            return `After ${"2 months"}`;
        case "After a specific date":
            return `After ${"04.02.2022"}`;
    }
}

const ExperienceCalculation = () => {
    var total_exp = 10;
    var output = [];
    if (total_exp) {
        output.push(`${total_exp} years`);
    }
    var is_teamlead = 3;
    if (is_teamlead > 0) {
        output.push("Manager");
    }
    return output.join(",");
    total_exp = parseInt(total_exp);
    var list_of_start_jobs = [];
    var list_of_end_jobs = [];
    if (list_of_end_jobs.length && list_of_start_jobs.length) {
        let min_length = Math.min(list_of_start_jobs.length, list_of_end_jobs.length);
        list_of_end_jobs = list_of_end_jobs.slice(0, min_length);
        list_of_start_jobs = list_of_start_jobs.slice(0, min_length);
        let diffs = [];
        for (let i = 0; i < min_length; i++)
            diffs.push(list_of_end_jobs[i] - list_of_start_jobs[i]);
        let longest_job = Math.max(diffs);
        if (longest_job >= 4)
            output.push("Senior");
        else if (longest_job >= 2)
            output.push("Middle");
        else if (longest_job < 2)
            output.push("Junior");
    }
    var output = [];

    if (total_exp >= 8)
        output.push("Manager");
    else if (total_exp >= 6)
        output.push("Team Lead");

    return output.join(",");
}

// bubble_fn_ConvertWorkTimeToString(ConvertJobTypesToString());
// bubble_fn_ConvertPlacementToString(ConvertPlacementToString());
// bubble_fn_ConvertCanStartFunction(ConvertCanStartFunction());
// ФУНКЦИИ ФИЛЬТРАЦИИ
// jobTypeFilter
const jobTypeFilter = (JobTypeContract, JobTypeInternship, JobTypeParttime, JobTypePermanent) => {
    
}

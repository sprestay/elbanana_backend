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

bubble_fn_ConvertWorkTimeToString(ConvertJobTypesToString());
bubble_fn_ConvertPlacementToString(ConvertPlacementToString());
bubble_fn_ConvertCanStartFunction(ConvertCanStartFunction());
// ФУНКЦИИ ФИЛЬТРАЦИИ
// jobTypeFilter
const jobTypeFilter = (JobTypeContract, JobTypeInternship, JobTypeParttime, JobTypePermanent) => {
    
}

